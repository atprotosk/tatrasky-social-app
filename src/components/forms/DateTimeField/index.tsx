import {useState} from 'react'
import {Keyboard, View} from 'react-native'
import {DateTimePicker} from '@expo/ui/community/datetime-picker'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {DateFieldButton} from '#/components/forms/DateField/index.shared'
import {type DateTimeFieldProps} from './types'
import {fromDateTimeLocal, toDateTimeLocal} from './utils'

export * as utils from '#/components/forms/DateTimeField/utils'

/**
 * Date and time input, value in the local `YYYY-MM-DDTHH:mm` form. iOS opens a
 * datetime spinner; Android and web have their own implementations.
 */
export function DateTimeField({
  value,
  onChangeDateTime,
  onConfirm,
  placeholder,
  label,
  isInvalid,
  testID,
  accessibilityHint,
  minimumDate,
}: DateTimeFieldProps) {
  const {t: l, i18n} = useLingui()
  const t = useTheme()
  const control = Dialog.useDialogControl()
  const fallback = minimumDate ?? new Date()
  const [draft, setDraft] = useState(
    () => fromDateTimeLocal(value) ?? new Date(fallback),
  )

  const open = () => {
    Keyboard.dismiss()
    setDraft(fromDateTimeLocal(value) ?? new Date(fallback))
    control.open()
  }
  const format = (v: string | Date) =>
    i18n.date(typeof v === 'string' ? (fromDateTimeLocal(v) ?? v) : v, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

  return (
    <>
      <DateFieldButton
        label={label}
        value={value}
        format={format}
        placeholder={placeholder}
        onPress={open}
        isInvalid={isInvalid}
        accessibilityHint={accessibilityHint}
      />
      <Dialog.Outer
        control={control}
        testID={testID}
        nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <Dialog.ScrollableInner label={label}>
          <View style={a.gap_lg}>
            <View style={[a.relative, a.w_full, a.align_center]}>
              <DateTimePicker
                style={a.w_full}
                value={draft}
                onValueChange={(_event, date) => {
                  if (date) setDraft(date)
                }}
                mode="datetime"
                display="spinner"
                themeVariant={t.scheme}
                // SwiftUI wants `pt_BR`, not BCP 47's `pt-BR`.
                locale={i18n.locale.replace(/-/g, '_')}
                testID={`${testID}-datetimepicker`}
                minimumDate={minimumDate}
              />
            </View>
            <Button
              label={l`Done`}
              onPress={() => {
                const next = toDateTimeLocal(draft)
                control.close(() => {
                  onChangeDateTime(next)
                  onConfirm?.(next)
                })
              }}
              size="large"
              color="primary"
              variant="solid">
              <ButtonText>
                <Trans>Done</Trans>
              </ButtonText>
            </Button>
          </View>
        </Dialog.ScrollableInner>
      </Dialog.Outer>
    </>
  )
}
