#!/usr/bin/env node
/*
 * Append English catalog entries that are missing from another locale's
 * catalog (default: sk), with an empty msgstr, so they show up as untranslated
 * in Poedit / a text editor.
 *
 * Append-only: existing lines in the target file are never modified, so the
 * Poedit formatting of the target catalog is preserved. Entries that exist in
 * the target but no longer in English are reported, never deleted.
 *
 * Usage:
 *   pnpm intl:add-missing            # sk
 *   pnpm intl:add-missing sk --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOCALES_DIR = path.join(ROOT, 'src/locale/locales')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const locale = args.find(arg => !arg.startsWith('--')) ?? 'sk'

const sourcePath = path.join(LOCALES_DIR, 'en', 'messages.po')
const targetPath = path.join(LOCALES_DIR, locale, 'messages.po')

if (locale === 'en') {
  console.error('Target locale must not be "en".')
  process.exit(1)
}
if (!fs.existsSync(targetPath)) {
  console.error(`No catalog found at ${path.relative(ROOT, targetPath)}`)
  process.exit(1)
}

/**
 * Split a .po file into entries. Each entry keeps its raw lines plus the
 * joined msgctxt / msgid values (multi-line "..." continuations concatenated).
 */
function parsePo(text) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n[ \t]*\n/)
  const entries = []
  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.length > 0)
    if (lines.length === 0) continue
    // Obsolete entries (#~) are not live messages.
    if (lines.every(line => line.startsWith('#'))) continue

    const fields = {}
    let current = null
    for (const line of lines) {
      const match = line.match(/^(msgctxt|msgid|msgstr)\s+"(.*)"\s*$/)
      if (match) {
        current = match[1]
        fields[current] = match[2]
      } else if (current && /^\s*"/.test(line)) {
        fields[current] += line.trim().slice(1, -1)
      } else {
        current = null
      }
    }
    if (fields.msgid === undefined) continue
    // Header entry.
    if (fields.msgid === '' && fields.msgctxt === undefined) continue

    entries.push({
      key: `${fields.msgctxt ?? ''}\u0004${fields.msgid}`,
      msgid: fields.msgid,
      lines,
    })
  }
  return entries
}

/**
 * Rebuild an English entry for the target catalog: keep comments, msgctxt and
 * msgid lines as-is, replace the msgstr (and its continuations) with "".
 */
function toUntranslated(entry) {
  const out = []
  let inMsgstr = false
  for (const line of entry.lines) {
    if (/^msgstr\s/.test(line)) {
      inMsgstr = true
      out.push('msgstr ""')
      continue
    }
    if (inMsgstr && /^\s*"/.test(line)) continue
    inMsgstr = false
    // Fuzzy flags from the source don't apply to an untranslated entry.
    if (/^#,/.test(line)) continue
    out.push(line)
  }
  return out.join('\n')
}

const sourceEntries = parsePo(fs.readFileSync(sourcePath, 'utf8'))
const targetText = fs.readFileSync(targetPath, 'utf8')
const targetEntries = parsePo(targetText)

const targetKeys = new Set(targetEntries.map(entry => entry.key))
const sourceKeys = new Set(sourceEntries.map(entry => entry.key))

const missing = sourceEntries.filter(entry => !targetKeys.has(entry.key))
const stale = targetEntries.filter(entry => !sourceKeys.has(entry.key))

const preview = 20
console.log(
  `${missing.length} English entr${missing.length === 1 ? 'y' : 'ies'} missing from ${locale}/messages.po`,
)
for (const entry of missing.slice(0, preview)) {
  console.log(`  + ${entry.msgid.slice(0, 100)}`)
}
if (missing.length > preview) {
  console.log(`  ... and ${missing.length - preview} more`)
}
if (stale.length > 0) {
  console.log(
    `${stale.length} ${locale} entr${stale.length === 1 ? 'y is' : 'ies are'} no longer in English (left untouched)`,
  )
}

if (missing.length === 0) process.exit(0)
if (dryRun) {
  console.log('Dry run: nothing written.')
  process.exit(0)
}

const separator = targetText.endsWith('\n\n')
  ? ''
  : targetText.endsWith('\n')
    ? '\n'
    : '\n\n'
const appended = missing.map(toUntranslated).join('\n\n') + '\n'
fs.writeFileSync(targetPath, targetText + separator + appended)
console.log(
  `Appended ${missing.length} entr${missing.length === 1 ? 'y' : 'ies'} to ${path.relative(ROOT, targetPath)}`,
)
