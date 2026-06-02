import type {
  Counter,
  User,
  OperatorSession,
  OperatorSessionStatus,
  Ticket,
  CreateOperatorSessionRequest,
  CallNextRequest,
  TransferTicketRequest,
} from '@queue/types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  listCounters: () => fetch('/api/counters').then(json<Counter[]>),
  listUsers: () => fetch('/api/users').then(json<User[]>),

  createSession: (body: CreateOperatorSessionRequest) =>
    fetch('/api/operator-sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<OperatorSession>),

  updateSession: (id: number, status: OperatorSessionStatus) =>
    fetch(`/api/operator-sessions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(json<OperatorSession>),

  getQueue: (counterId: number) =>
    fetch(`/api/queue?counter_id=${counterId}`).then(json<Ticket[]>),

  getCurrent: (counterId: number) =>
    fetch(`/api/tickets/current?counter_id=${counterId}`).then(
      json<Ticket | null>,
    ),

  callNext: (body: CallNextRequest) =>
    fetch('/api/tickets/call-next', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Ticket>),

  finishTicket: (id: string) =>
    fetch(`/api/tickets/${id}/finish`, { method: 'POST' }).then(json<Ticket>),

  skipTicket: (id: string) =>
    fetch(`/api/tickets/${id}/skip`, { method: 'POST' }).then(json<Ticket>),

  transferTicket: (id: string, body: TransferTicketRequest) =>
    fetch(`/api/tickets/${id}/transfer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Ticket>),
};
