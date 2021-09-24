import * as _ from 'jsonous'
import fetch from 'node-fetch'
import xml2js from 'xml2js'
import { parseStringPromise as parseString } from 'xml2js'

import { getBasicAuth } from './common'
import { XML_SERVICE_URL } from './constants'

const FULL_URL = `${XML_SERVICE_URL}/epmx/services/messagesService`

const xmlBuilder = new xml2js.Builder()

export const getLabels = async (
  { username, password }: { username: string; password: string },
  barcode: string,
) => {
  const response = await fetch(FULL_URL, {
    method: 'post',
    body: xmlBuilder.buildObject({
      'soapenv:Envelope': {
        $: {
          'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
          'xmlns:xsd': 'http://service.core.epmx.application.eestipost.ee/xsd',
        },
        'soapenv:Header': '',
        'soapenv:Body': {
          'xsd:addrcardMsgRequest': {
            partner: username,
            sendAddressCardTo: 'response',
            barcodes: { barcode },
            format: 'pdf',
          },
        },
      },
    }),
    headers: {
      Authorization: getBasicAuth({ username, password }),
      'Content-Type': 'text/xml',
      Accept: 'text/xml',
    },
  })

  const xml = await response.text()
  const parsedXML: unknown = await parseString(xml, {
    trim: true,
    explicitArray: false,
    ignoreAttrs: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  })

  if (!response.ok) return Promise.reject(response.statusText)

  const [fileData, errorMessage] = _.at(
    [
      'Envelope',
      'Body',
      'addrcardMsgResponse',
      'successAddressCards',
      'addressCardData',
      'fileData',
    ],
    _.string,
  )
    .decodeAny(parsedXML)
    .cata<[string | null, string]>({
      Ok: (val) => [val, ''],
      Err: (msg) => [null, msg],
    })

  if (fileData === null) return Promise.reject(errorMessage)

  return fileData
}
