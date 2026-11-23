import {useRef} from 'react'
import {StyleSheet, View} from 'react-native'
// @ts-expect-error untyped
import {unstable_createElement} from 'react-native-web'
import {useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {DateFieldButton} from '#/components/forms/DateField/index.shared'
import {type DateTimeFieldProps} from './types'
import {fromDateTimeLocal, toDateTimeLocal} from './utils'

export * as utils from '#/components/forms/DateTimeField/utils'

/**
 * Date and time input, value in the local `YYYY-MM-DDTHH:mm` form.
 *
 * A visible `<input type="datetime-local">` writes the date in the browser's
 * own locale, so an English (US) browser shows MM/DD/YYYY whatever language
 * the app is in. Instead the field shows the value formatted in the app's
 * language, like on native, and opens the browser's picker from an invisible
 * input laid over it.
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
  const {i18n} = useLingui()
  const inputRef = useRef<HTMLInputElement>(null)

  const open = () => {
    const input = inputRef.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      // Browsers without showPicker() for this input type still open it here.
      input.focus()
      input.click()
    }
  }

  const onChange = (e: {target: {value: string}}) => {
    const next = e.target.value
    if (fromDateTimeLocal(next)) {
      onChangeDateTime(next)
      onConfirm?.(next)
    }
  }

  return (
    <View style={[a.relative, a.w_full]}>
      <DateFieldButton
        label={label}
        value={value}
        format={v =>
          i18n.date(typeof v === 'string' ? (fromDateTimeLocal(v) ?? v) : v, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        }
        placeholder={placeholder}
        onPress={open}
        isInvalid={isInvalid}
        accessibilityHint={accessibilityHint}
      />
      {/* oxlint-disable-next-line typescript/no-unsafe-call -- untyped react-native-web export */}
      {unstable_createElement('input', {
        ref: inputRef,
        type: 'datetime-local',
        step: 60,
        value,
        min: minimumDate ? toDateTimeLocal(minimumDate) : undefined,
        onChange,
        'data-testid': testID,
        tabIndex: -1,
        'aria-hidden': true,
        /*
         * Laid over the field so the picker opens beside it, but invisible and
         * not clickable: the field above is what people see and press.
         */
        style: [
          StyleSheet.absoluteFill,
          {opacity: 0, pointerEvents: 'none', border: 0},
        ],
      })}
    </View>
  )
}
