/** @jest-environment node */
import { isRouteProtected } from '@/utils/is-route-protected'

// isRouteProtected retourne true quand l'accès doit être REFUSÉ au rôle donné
describe('isRouteProtected', () => {
  it('lets admins reach admin-only pages', () => {
    expect(isRouteProtected('ADMIN', '/devices')).toBe(false)
    expect(isRouteProtected('SUPER_ADMIN', '/integrations')).toBe(false)
  })

  it('blocks agents from admin-only pages', () => {
    expect(isRouteProtected('AGENT', '/devices')).toBe(true)
    expect(isRouteProtected('USER', '/integrations')).toBe(true)
  })

  it('applies the same rule to nested paths', () => {
    expect(isRouteProtected('ADMIN', '/admin/users')).toBe(false)
    expect(isRouteProtected('AGENT', '/admin/users')).toBe(true)
  })

  it('reserves the owner console to the platform owner', () => {
    expect(isRouteProtected('SUPER_ADMIN', '/admin/organizations')).toBe(false)
    expect(isRouteProtected('ADMIN', '/admin/organizations')).toBe(true)
  })

  it('also covers sub-pages of a protected route', () => {
    expect(isRouteProtected('AGENT', '/devices/abc123')).toBe(true)
  })

  it('does not block pages every role may see', () => {
    expect(isRouteProtected('AGENT', '/dashboard')).toBe(false)
    expect(isRouteProtected('AGENT', '/scans')).toBe(false)
  })

  it('ignores routes that are not in the navigation', () => {
    expect(isRouteProtected('USER', '/profile')).toBe(false)
  })
})
