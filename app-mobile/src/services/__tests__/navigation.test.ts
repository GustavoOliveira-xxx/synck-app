import { parentRoute, pathFromRoute } from '../navigation';

jest.mock('expo-router', () => ({ router: { canGoBack: () => false, back: jest.fn(), replace: jest.fn() } }));

describe('tela mãe (voltar sem histórico)', () => {
  it.each([
    ['/calendar/abc/members', '/calendar/abc'],
    ['/calendar/abc/member/u1', '/calendar/abc/members'],
    ['/calendar/abc', '/calendars'],
    ['/calendar/new', '/calendars'],
    ['/event/e1/edit', '/event/e1'],
    ['/event/e1', '/month'],
    ['/event/new', '/month'],
    ['/task/t1/block', '/task/t1'],
    ['/task/t1', '/tasks'],
    ['/task/new', '/tasks'],
    ['/notes/n1', '/notes'],
    ['/notes', '/tasks'],
    ['/habits', '/tasks'],
    ['/settings/password', '/profile'],
    ['/sync/op1', '/sync'],
    ['/sync', '/profile'],
    ['/invites/accept', '/calendars'],
    ['/notifications', '/'],
    ['/create?date=2026-10-31', '/'],
  ])('%s volta para %s', (path, parent) => {
    expect(parentRoute(path)).toBe(parent);
  });

  it('monta o endereço a partir da rota', () => {
    expect(pathFromRoute('calendar/[id]/member/[memberId]', { id: 'a', memberId: 'b' })).toBe(
      '/calendar/a/member/b',
    );
    expect(pathFromRoute('task/[id]/index', { id: 't' })).toBe('/task/t');
  });
});
