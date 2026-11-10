import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {useOpenPdsAccountPage} from '#/lib/hooks/useOpenPdsAccountPage'
import {useSession} from '#/state/session'
import {useDialogControl} from '#/components/Dialog'
import {
  EmailDialogScreenID,
  useEmailDialogControl,
} from '#/components/dialogs/EmailDialog'
import {DisableEmail2FADialog} from './DisableEmail2FADialog'
import * as SettingsList from './SettingsList'

export function Email2FAToggle() {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const disableDialogControl = useDialogControl()
  const emailDialogControl = useEmailDialogControl()

  const pdsAccountPage = useOpenPdsAccountPage()
  const isOauth = currentAccount?.isOauthSession === true

  const onToggle = () => {
    // OAuth sessions can't manage email 2FA; that happens on the PDS.
    if (isOauth) {
      pdsAccountPage.open()
      return
    }
    emailDialogControl.open({
      id: EmailDialogScreenID.Manage2FA,
    })
  }

  return (
    <>
      <DisableEmail2FADialog control={disableDialogControl} />
      <SettingsList.BadgeButton
        label={
          currentAccount?.emailAuthFactor ? _(msg`Change`) : _(msg`Enable`)
        }
        onPress={onToggle}
      />
    </>
  )
}
