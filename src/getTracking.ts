import * as _ from 'jsonous'
import Decoder from 'jsonous'
import fetch from 'node-fetch'
import { parseStringPromise as parseString } from 'xml2js'
import xml2js from 'xml2js'

export interface TrackEvent {
  name: string
  date: string
  location: string
}

export const locationDecoder: Decoder<TrackEvent> = _.field(
  'td',
  _.succeed({})
    .assign('name', _.at([0], _.string))
    .assign('date', _.at([1], _.string))
    .assign('location', _.at([2], _.string)),
)

export const getTracking = async (barcode: string, language = 'eng'): Promise<TrackEvent[]> => {
  const response = await fetch(
    `https://www.omniva.lt/api/search.php?search_barcode=${barcode}&lang=${language}`,
  )

  if (!response.ok) return Promise.reject(response.statusText)

  const xml = await response.text()

  const parsedXML: any = await parseString(xml, {
    trim: true,
    explicitArray: false,
    normalizeTags: true,
    ignoreAttrs: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  })

  const [events, errorMessage] = _.at(['table', 'tbody', 'tr'], _.array(locationDecoder))
    .decodeAny(parsedXML)
    .cata<[TrackEvent[] | null, string]>({
      Ok: (val) => [val, ''],
      Err: (msg) => [null, msg],
    })

  if (events === null) return Promise.reject(errorMessage)

  return events
}
