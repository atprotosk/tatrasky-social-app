import {Linking} from 'react-native'

import {pdsAccountLink} from '#/lib/pdsAccountLink'
import {useSession} from '#/state/session'

/**
 * The current account's hosting-provider account page. OAuth sessions can't
 * perform privileged operations (changing email, managing 2FA or app
 * passwords, etc.), so we send the user there instead.
 */
export function useOpenPdsAccountPage() {
  const {currentAccount} = useSession()
  const link = pdsAccountLink({
    pdsUrl: currentAccount?.pdsUrl,
    service: currentAccount?.service,
  })
  const open = () => {
    if (link.url) void Linking.openURL(link.url)
  }
  return {...link, open}
}
