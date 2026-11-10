import {type Props} from '#/components/icons/common'
import {VerifiedCheck} from '#/components/icons/VerifiedCheck'
import {VerifierCheck} from '#/components/icons/VerifierCheck'
import {ACCENTS} from '#/config/brand-theme'

/**
 * Verification checkmarks always render in the default blue, regardless of
 * the accent the user picked, so the badge reads the same for everyone.
 * `_500` is pinned across light/dark/dim, so one value works for all themes.
 */
export const VERIFICATION_CHECK_COLOR = ACCENTS.blue.primary_500

export function VerificationCheck({
  verifier,
  fill = VERIFICATION_CHECK_COLOR,
  ...rest
}: Props & {
  verifier?: boolean
}) {
  return verifier ? (
    <VerifierCheck fill={fill} {...rest} />
  ) : (
    <VerifiedCheck fill={fill} {...rest} />
  )
}
