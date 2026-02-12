import { describe, expect, it } from 'vitest'

import {
  buildTipDraftPayload,
  createEmptyTipEditorState,
  validateTipEditorForm,
} from './tip-editor'

describe('tip editor validation', () => {
  it('requires core structured fields', () => {
    const errors = validateTipEditorForm(createEmptyTipEditorState())

    expect(errors.symptom).toBe('Symptom is required.')
    expect(errors.rootCause).toBe('Root cause is required.')
    expect(errors.fix).toBe('Fix is required.')
    expect(errors.prevention).toBe('Prevention is required.')
  })

  it('parses comma/newline list values and de-duplicates case-insensitively', () => {
    const { payload, errors } = buildTipDraftPayload({
      symptom: 'Button clicks submit twice',
      rootCause: 'An effect registers duplicate event listeners.',
      fix: 'Scope listener setup to a single lifecycle branch.',
      prevention: 'Use cleanup callbacks and add regression tests.',
      tags: 'react, hooks,React\nfrontend',
      references: 'https://internal/wiki/bug-12, https://internal/wiki/bug-12\nRFC-77',
    })

    expect(errors).toEqual({})
    expect(payload).toEqual({
      symptom: 'Button clicks submit twice',
      rootCause: 'An effect registers duplicate event listeners.',
      fix: 'Scope listener setup to a single lifecycle branch.',
      prevention: 'Use cleanup callbacks and add regression tests.',
      tags: ['react', 'hooks', 'frontend'],
      references: ['https://internal/wiki/bug-12', 'RFC-77'],
    })
  })

  it('returns field errors when validation fails', () => {
    const { payload, errors } = buildTipDraftPayload({
      symptom: '  ',
      rootCause: 'cause',
      fix: 'fix',
      prevention: 'prevent',
      tags: '',
      references: '',
    })

    expect(payload).toBeNull()
    expect(errors.symptom).toBe('Symptom is required.')
  })
})
