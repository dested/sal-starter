// The only thing that crosses the context bridge: `window.trpcIpc`.
import { exposeTrpcIpc } from '@app/trpc-ipc/preload'

exposeTrpcIpc()
