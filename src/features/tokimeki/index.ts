import {type CustomEmbedHandler} from '#/features/customEmbeds/types'
import {TokimekiPollEmbed} from './components/TokimekiPollEmbed'
import {tokimekiPollRefFromView} from './parse'

export const tokimekiPollHandler: CustomEmbedHandler = {
  id: 'tokimekiPoll',
  match: view => Boolean(tokimekiPollRefFromView(view)),
  Component: TokimekiPollEmbed,
}
