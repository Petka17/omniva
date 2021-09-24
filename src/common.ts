export const getBasicAuth = ({ username, password }: { username: string; password: string }) =>
  `Basic ${Buffer.from(username + ':' + password).toString('base64')}`
