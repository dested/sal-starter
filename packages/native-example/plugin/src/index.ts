import { createRunOncePlugin, withInfoPlist, type ConfigPlugin } from 'expo/config-plugins'

type Props = { value?: string } | void

// A typed config plugin: the shape packages/vision will use to own its native
// requirements (usage strings, deployment target). This one writes one
// Info.plist key that the Swift module reads back at runtime.
const withNativeExample: ConfigPlugin<Props> = (config, props) =>
  withInfoPlist(config, (mod) => {
    mod.modResults.SalNativeExample = props?.value ?? 'written by @app/native-example'
    return mod
  })

export default createRunOncePlugin(withNativeExample, '@app/native-example', '0.1.0')
