# Named ChrpWidgetBridge, not ChrpWidget: the pod name becomes the Swift module
# name, and ChrpWidget is already the widget extension's module (iOS 17+). With
# the same name the app imported the extension's module and failed to compile.
Pod::Spec.new do |s|
  s.name           = 'ChrpWidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'Shares the signed-in player with the Chrp Home Screen widget.'
  s.description    = 'Writes the widget configuration to the shared App Group and reloads widget timelines.'
  s.author         = 'Chrp'
  s.homepage       = 'https://chrp-app.web.app'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
