Pod::Spec.new do |s|
  s.name           = 'NativeExample'
  s.version        = '0.1.0'
  s.summary        = 'Workspace native package example'
  s.description    = 'Workspace native package + typed config plugin example for sal-starter (packages/native-example).'
  s.author         = ''
  s.homepage       = 'https://github.com/dested/sal-starter'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
