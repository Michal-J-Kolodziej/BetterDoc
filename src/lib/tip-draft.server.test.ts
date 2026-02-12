import { describe, expect, it } from 'vitest'

import { buildTipMetadata, normalizeTipDraftInput } from '../../convex/tipDraft'

describe('normalizeTipDraftInput', () => {
  it('normalizes structured body fields and list values', () => {
    const normalized = normalizeTipDraftInput({
      symptom: '  Null pointer when invoice has no customer  ',
      rootCause: ' Optional customerId was not guarded. ',
      fix: ' Add null checks before dereferencing customer. ',
      prevention: ' Add fixture coverage for missing customer IDs. ',
      project: ' media-press ',
      library: ' billing-core ',
      component: ' InvoiceSummary ',
      tags: [' backend ', 'billing', 'Backend'],
      references: [' RFC-112 ', 'rfc-112', 'https://internal/wiki/invoice'],
    })

    expect(normalized).toEqual({
      symptom: 'Null pointer when invoice has no customer',
      rootCause: 'Optional customerId was not guarded.',
      fix: 'Add null checks before dereferencing customer.',
      prevention: 'Add fixture coverage for missing customer IDs.',
      project: 'media-press',
      library: 'billing-core',
      component: 'InvoiceSummary',
      tags: ['backend', 'billing'],
      references: ['RFC-112', 'https://internal/wiki/invoice'],
    })
  })

  it('throws when required text fields are blank', () => {
    expect(() =>
      normalizeTipDraftInput({
        symptom: ' ',
        rootCause: 'cause',
        fix: 'fix',
        prevention: 'prevention',
        project: '',
        library: '',
        component: '',
        tags: [],
        references: [],
      }),
    ).toThrowError('Symptom is required.')
  })
})

describe('buildTipMetadata', () => {
  it('builds stable title + slug values from symptom text', () => {
    const metadata = buildTipMetadata('Race condition in auth callback handler', 12345)

    expect(metadata.title).toBe('Race condition in auth callback handler')
    expect(metadata.slug).toBe('race-condition-in-auth-callback-handler-9ix')
  })
})
