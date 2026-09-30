Pod::Spec.new do |s|
  s.name           = 'ChrpWidget'
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
