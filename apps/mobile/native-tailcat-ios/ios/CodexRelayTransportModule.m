#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <Bridge/Bridge.h>

static NSString *const kTailcatDefaultsSuite = @"codex-relay-tailcat";
static NSString *const kServerAddrKey = @"serverAddr";
static NSString *const kRemotePortKey = @"remotePort";
static NSString *const kLanTargetsKey = @"lanTargetsJson";
static NSString *const kModeKey = @"mode";

@interface CodexRelayTransportModule : NSObject <RCTBridgeModule>
@property(nonatomic, strong) NSUserDefaults *defaults;
@property(nonatomic) dispatch_queue_t transportQueue;
@end

@implementation CodexRelayTransportModule

RCT_EXPORT_MODULE(CodexRelayTransport)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _defaults = [[NSUserDefaults alloc] initWithSuiteName:kTailcatDefaultsSuite];
    _transportQueue = dispatch_queue_create("com.gronstudio.codexrelay.tailcat", DISPATCH_QUEUE_SERIAL);
    dispatch_async(_transportQueue, ^{
      [self restoreProxyIfConfigured];
    });
  }
  return self;
}

- (dispatch_queue_t)methodQueue {
  return self.transportQueue;
}

RCT_REMAP_METHOD(configureRelayProxy,
                 configureRelayProxy:(NSString *)serverAddr
                 remotePort:(nonnull NSNumber *)remotePort
                 lanTargetsJson:(NSString *)lanTargetsJson
                 mode:(NSString *)mode
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  NSError *error = nil;
  NSString *localURL = nil;
  BOOL ok = GoBridgeConfigureProxy(
      serverAddr,
      remotePort.longLongValue,
      lanTargetsJson ?: @"[]",
      mode ?: @"auto",
      [self clientKeyPath],
      &localURL,
      &error);
  if (!ok || error != nil || localURL.length == 0) {
    [self reject:reject code:@"TAILCAT_CONFIGURE_FAILED" error:error fallback:@"Tailcat proxy configuration failed."];
    return;
  }

  [self.defaults setObject:serverAddr forKey:kServerAddrKey];
  [self.defaults setObject:remotePort forKey:kRemotePortKey];
  [self.defaults setObject:lanTargetsJson ?: @"[]" forKey:kLanTargetsKey];
  [self.defaults setObject:mode ?: @"auto" forKey:kModeKey];
  if (![self.defaults synchronize]) {
    reject(@"TAILCAT_CONFIGURE_FAILED", @"Could not persist Tailcat transport configuration.", nil);
    return;
  }
  resolve(localURL);
}

RCT_REMAP_METHOD(startTailcatProxy,
                 startTailcatProxy:(NSString *)serverAddr
                 remotePort:(nonnull NSNumber *)remotePort
                 startResolver:(RCTPromiseResolveBlock)resolve
                 startRejecter:(RCTPromiseRejectBlock)reject) {
  NSError *error = nil;
  NSString *localURL = nil;
  BOOL ok = GoBridgeConfigureProxy(
      serverAddr,
      remotePort.longLongValue,
      @"[]",
      @"remote",
      [self clientKeyPath],
      &localURL,
      &error);
  if (!ok || error != nil || localURL.length == 0) {
    [self reject:reject code:@"TAILCAT_CONFIGURE_FAILED" error:error fallback:@"Tailcat proxy configuration failed."];
    return;
  }
  [self.defaults setObject:serverAddr forKey:kServerAddrKey];
  [self.defaults setObject:remotePort forKey:kRemotePortKey];
  [self.defaults setObject:@"[]" forKey:kLanTargetsKey];
  [self.defaults setObject:@"remote" forKey:kModeKey];
  [self.defaults synchronize];
  resolve(localURL);
}

RCT_REMAP_METHOD(stopTailcatProxy,
                 stopTailcatProxyWithResolver:(RCTPromiseResolveBlock)resolve
                 stopRejecter:(RCTPromiseRejectBlock)reject) {
  [self.defaults removePersistentDomainForName:kTailcatDefaultsSuite];
  NSError *error = nil;
  BOOL ok = GoBridgeStopProxy(&error);
  if (!ok || error != nil) {
    [self reject:reject code:@"TAILCAT_STOP_FAILED" error:error fallback:@"Tailcat proxy shutdown failed."];
    return;
  }
  resolve(nil);
}

RCT_REMAP_METHOD(tailcatStatus,
                 tailcatStatusWithResolver:(RCTPromiseResolveBlock)resolve
                 statusRejecter:(RCTPromiseRejectBlock)reject) {
  NSString *status = GoBridgeStatusJSON();
  if (status.length == 0) {
    reject(@"TAILCAT_STATUS_FAILED", @"Tailcat returned an empty status.", nil);
    return;
  }
  resolve(status);
}

RCT_REMAP_METHOD(refreshTailcatPath,
                 refreshTailcatPathWithResolver:(RCTPromiseResolveBlock)resolve
                 refreshRejecter:(RCTPromiseRejectBlock)reject) {
  NSString *status = GoBridgeRefreshPath();
  if (status.length == 0) {
    reject(@"TAILCAT_STATUS_FAILED", @"Tailcat returned an empty path status.", nil);
    return;
  }
  resolve(status);
}

RCT_REMAP_METHOD(discoverLocalRelay,
                 discoverLocalRelay:(nonnull NSNumber *)timeoutMs
                 discoveryResolver:(RCTPromiseResolveBlock)resolve
                 discoveryRejecter:(RCTPromiseRejectBlock)reject) {
  // LAN addresses already arrive in the signed pairing payload. Android adds
  // NSD as an optimization; iOS can safely rely on those verified candidates.
  (void)timeoutMs;
  (void)reject;
  resolve(nil);
}

- (void)restoreProxyIfConfigured {
  NSString *serverAddr = [self.defaults stringForKey:kServerAddrKey];
  NSNumber *remotePort = [self.defaults objectForKey:kRemotePortKey];
  if (serverAddr.length == 0 || remotePort == nil || remotePort.longLongValue < 1 || remotePort.longLongValue > 65535) {
    return;
  }
  NSString *lanTargets = [self.defaults stringForKey:kLanTargetsKey] ?: @"[]";
  NSString *mode = [self.defaults stringForKey:kModeKey] ?: @"auto";
  NSError *error = nil;
  NSString *localURL = nil;
  GoBridgeConfigureProxy(
      serverAddr,
      remotePort.longLongValue,
      lanTargets,
      mode,
      [self clientKeyPath],
      &localURL,
      &error);
}

- (NSString *)clientKeyPath {
  NSURL *supportURL = [[[NSFileManager defaultManager] URLsForDirectory:NSApplicationSupportDirectory
                                                               inDomains:NSUserDomainMask] firstObject];
  if (supportURL == nil) {
    supportURL = [NSURL fileURLWithPath:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Application Support"]];
  }
  NSURL *directory = [supportURL URLByAppendingPathComponent:@"Codex Relay Plus" isDirectory:YES];
  return [[directory URLByAppendingPathComponent:@"tailcat-client-key"] path];
}

- (void)reject:(RCTPromiseRejectBlock)reject
          code:(NSString *)code
         error:(NSError *)error
      fallback:(NSString *)fallback {
  NSString *message = error.localizedDescription.length > 0 ? error.localizedDescription : fallback;
  reject(code, message, error);
}

@end
