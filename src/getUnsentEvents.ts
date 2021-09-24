import * as _ from 'jsonous'
import Decoder from 'jsonous'
import fetch from 'node-fetch'
import { err, ok } from 'resulty'
import { parseStringPromise as parseString } from 'xml2js'

import { getBasicAuth } from './common'
import { XML_SERVICE_URL } from './constants'

const getEventUrl = (username: string) =>
  `${XML_SERVICE_URL}/epteavitus/events/unsent/for-client-code/${username}`

interface Event {
  id: string
  date: string
  code: string
  stateCode: string
  source: {
    value: string | undefined
    zip: string
  }
  barcode: string
}

const hasOwnProperty = <X extends object, Y extends PropertyKey>(
  obj: X,
  prop: Y,
): obj is X & Record<Y, unknown> => prop in obj

const eventDecoder: Decoder<Event> = _.succeed({})
  .assign('id', _.field('id', _.string))
  .assign('date', _.field('eventDate', _.string))
  .assign('code', _.field('eventCode', _.string))
  .assign('stateCode', _.field('stateCode', _.string))
  .assign(
    'source',
    _.succeed({})
      .assign(
        'value',
        _.field(
          'eventSource',
          new Decoder<string | undefined>((source: unknown) =>
            typeof source !== 'object' || source === null
              ? err('expected object')
              : hasOwnProperty(source, 'value') && typeof source.value === 'string'
              ? ok(source.value)
              : ok(undefined),
          ),
        ),
      )
      .assign('zip', _.at(['eventSource', 'zip'], _.string)),
  )
  .assign('barcode', _.field('packetCode', _.string))

const getUnsentEvents = async ({
  username,
  password,
}: {
  username: string
  password: string
}): Promise<Event[]> => {
  const response = await fetch(getEventUrl(username), {
    headers: {
      Authorization: getBasicAuth({ username, password }),
      Accept: 'text/xml',
    },
  })

  if (!response.ok) return Promise.reject(response.statusText)

  const xml = await response.text()

  const parsedXML: unknown = await parseString(xml, {
    charkey: 'value',
    mergeAttrs: true,
    trim: true,
    explicitArray: false,
    preserveChildrenOrder: true,
  })

  const [events, errorMessage] = _.field(
    'xsd:events',
    new Decoder<Event[]>((events: unknown) =>
      typeof events !== 'object' || events === null
        ? err('expected object')
        : hasOwnProperty(events, 'event')
        ? _.array(eventDecoder).decodeAny(events.event)
        : ok([]),
    ),
  )
    .decodeAny(parsedXML)
    .cata<[Event[] | null, string]>({
      Ok: (val) => [val, ''],
      Err: (msg) => [null, msg],
    })

  if (events === null) {
    return Promise.reject(errorMessage)
  }

  return events
}

export default getUnsentEvents
