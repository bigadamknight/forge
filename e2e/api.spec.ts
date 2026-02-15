import { test, expect, API_BASE as API } from './fixtures'

const FORGE_ID = '0dbe839d-e638-481f-a724-ca7d46a1df36'

test.describe('API Endpoints', () => {
  test('GET /forges returns forge list', async ({ request }) => {
    const res = await request.get(`${API}/forges`)
    expect(res.ok()).toBeTruthy()
    const forges = await res.json()
    expect(Array.isArray(forges)).toBeTruthy()
    expect(forges.length).toBeGreaterThan(0)
    const forge = forges[0]
    expect(forge).toHaveProperty('id')
    expect(forge).toHaveProperty('expertName')
    expect(forge).toHaveProperty('domain')
    expect(forge).toHaveProperty('status')
  })

  test('GET /forges/:id returns single forge', async ({ request }) => {
    const res = await request.get(`${API}/forges/${FORGE_ID}`)
    expect(res.ok()).toBeTruthy()
    const forge = await res.json()
    expect(forge.id).toBe(FORGE_ID)
    expect(forge.expertName).toBe('Adam Knight')
    expect(forge.domain).toBe('Star Wars Lego')
  })

  test('GET /forges/:id returns 404 for missing forge', async ({ request }) => {
    const res = await request.get(`${API}/forges/00000000-0000-0000-0000-000000000000`)
    expect(res.status()).toBe(404)
  })

  test('GET /forges/:id/tool returns tool config with components', async ({ request }) => {
    const res = await request.get(`${API}/forges/${FORGE_ID}/tool`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data).toHaveProperty('forge')
    expect(data).toHaveProperty('toolConfig')
    expect(data.toolConfig).toHaveProperty('layout')
    expect(Array.isArray(data.toolConfig.layout)).toBeTruthy()
    expect(data.toolConfig.layout.length).toBeGreaterThan(0)
    // Each component has required fields
    for (const component of data.toolConfig.layout) {
      expect(component).toHaveProperty('id')
      expect(component).toHaveProperty('type')
      expect(component).toHaveProperty('title')
    }
  })

  test('GET /forges/:id/interview returns interview state', async ({ request }) => {
    const res = await request.get(`${API}/forges/${FORGE_ID}/interview`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data).toHaveProperty('forge')
    expect(data).toHaveProperty('sections')
    expect(data).toHaveProperty('extractions')
    expect(data).toHaveProperty('currentRound')
    expect(Array.isArray(data.sections)).toBeTruthy()
    expect(data.extractions.length).toBeGreaterThan(0)
    // Extractions have required fields
    const extraction = data.extractions[0]
    expect(extraction).toHaveProperty('type')
    expect(extraction).toHaveProperty('content')
  })

  test('POST /forges creates a new forge', async ({ request }) => {
    const res = await request.post(`${API}/forges`, {
      data: {
        title: 'Automated Testing - E2E Test Expert',
        expertName: 'E2E Test Expert',
        domain: 'Automated Testing',
        targetAudience: 'QA engineers',
      },
    })
    expect(res.ok()).toBeTruthy()
    const forge = await res.json()
    expect(forge).toHaveProperty('id')
    expect(forge.expertName).toBe('E2E Test Expert')
    expect(forge.domain).toBe('Automated Testing')
    expect(forge.status).toBe('draft')
    // Clean up
    await request.delete(`${API}/forges/${forge.id}`)
  })

  test('POST /forges validates required fields', async ({ request }) => {
    const res = await request.post(`${API}/forges`, {
      data: { expertName: '' },
    })
    expect(res.ok()).toBeFalsy()
  })

  test('PATCH /forges/:id/tool-config accepts layout update', async ({ request }) => {
    const getRes = await request.get(`${API}/forges/${FORGE_ID}/tool`)
    const { toolConfig } = await getRes.json()
    // Patch back unchanged (idempotent)
    const patchRes = await request.patch(`${API}/forges/${FORGE_ID}/tool-config`, {
      data: { layout: toolConfig.layout },
    })
    expect(patchRes.ok()).toBeTruthy()
  })
})
