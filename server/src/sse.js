const clients = new Set();

export function addClient(res, context) {
  const client = { res, context };
  clients.add(client);
  res.on('close', () => {
    clients.delete(client);
  });
}

export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.res.write(payload);
  }
}

export function getClientCount() {
  return clients.size;
}
