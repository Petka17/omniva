export const getBasicAuth = ({
  username,
  password,
}: {
  username: string
  password: string
}): string => `Basic ${Buffer.from(username + ':' + password).toString('base64')}`

export type CountryCode = 'LT' | 'LV' | 'EE'
