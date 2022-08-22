import * as _ from 'jsonous'
import fetch from 'node-fetch'
import xml2js from 'xml2js'
import { parseStringPromise as parseString } from 'xml2js'

import { CountryCode, getBasicAuth } from './common'
import { XML_SERVICE_URL } from './constants'

const FULL_URL = `${XML_SERVICE_URL}/epmx/services/messagesService`

const xmlBuilder = new xml2js.Builder()

type ShipmentCategory = 'presend' | 'b2c' | 'c2c'

const getMainTag = (category: ShipmentCategory) =>
  category === 'presend'
    ? 'preSendMsg'
    : category === 'b2c'
    ? 'businessToClientMsg'
    : 'clientToClientMsg'

type MainService = 'QH' | 'QL' | 'PA' | 'PU' | 'PK' | 'PP'
type AdditionalService = 'BP' | 'SE' | 'SS' | 'BC' | 'SF' | 'ST' | 'BI' | 'GN' | 'GM'

export interface Measures {
  /**
   * Gross weight in kilograms.
   * The separator for the fraction is a decimal point
   * (no necessary in the case of full kilograms).
   * If the weight is not known or Omniva will do the weighing,
   * the value to be forwarded is 1
   */
  weight: number

  /**
   * Length (m); largest dimension
   */
  length?: number

  /**
   *  Width (m)
   */
  width?: number

  /**
   * Height (m)
   */
  height?: number
}

interface Country {
  /**
   *  2-letter country code (ISO 3166-1 alpha-2),  example: EE - Estonia.
   */
  country: CountryCode
}

export interface ParcelMachine extends Country {
  /**
   * Post office/parcel machine postcode for describing
   * the transport destination point where the offload takes place
   * – customer will get it from this location.
   * For correct zip codes, look at “Offload postal offices and parcel machines request”
   * If Offload is used with additional SMS service
   * receiver’s valid EE/LV/LT mobile phone number is required.
   */
  offloadPostcode: string
}

export interface Address extends Country {
  /**
   *  Postal code of the Post address; Usually required.
   * Not required when the destination is the parcel machine or
   * Estonian post office (look at offloadPostcode).
   * Estonian zip must be valid and 5 digits.
   * Latvian zip must be valid and with “LV-” prefix, Example: LV-1000
   * Lithuanian zip must be valid and 5 digits long.
   * If there is no zip code to provide for other country, use 00000.
   */
  postcode: string

  /**
   * Administrative unit: City, small town, village, rural municipality, county
   * Not required when the destination is post office/parcel machine (look at offloadPostcode).
   */
  deliverypoint: string

  /**
   *The street name, house number/letter and apartment number
   */
  street: string
}

export interface Contact {
  /**
   * Name and surname
   */
  person_name: string

  /**
   * For calling purpose
   */
  phone?: string

  /**
   * For SMS notification service. Number has to be valid: 
   * Supported (Estonian) mobile number formats and how numbers are described:
   * 1. 37251...
   * 2. +37255...
   * 3. 372  55 XX XXX – spaces, tabs, CR symbols are allowed
   * 4. 372-53-XXX-XXX
   * 5. 5123456
   *
   * All above conditions are allowed. Number must begin with 372, +372 or
   * with digit 5 and must be at least 7-digit long (excluded 372 and +372) and
   * not longer than 8 digits.
   *
   * Country codes rules (1-5) for Estonia, Latvia and Lithuania are same and
   * allowed, but numbers can be sent without it.
   *
   * Mobile phone number rules (does not include country codes)
   * Estonia   – have to start with number 5 or 8 and allowed length is 7 (only if 5 is first number) to 8 numbers.
   * Latvia    – have to start with number 2 and allowed length is 8 numbers
   * Lithuania – have to start with number 6 and allowed length is 8 numbers
   * OR  start with numbers 86  allowed length is 9 numbers

   * NB: Other countries phone numbers are not supported 
   * for additional service SMS notification!

   * Required when offload post office/parcel machine is appointed SMS is used for receiver notification. 
   * An additional service “Parcel arrival SMS”  is required.
   */
  mobile?: string

  /**
   * For receiver notification service
   */
  email?: string

  /**
   *
   */
  address: Address | ParcelMachine
}

export interface NewShipmentInfo {
  fileId?: string
  category: ShipmentCategory
  mainService: MainService
  additionalServices?: AdditionalService[]
  measures?: Measures
  receiver: Contact
  sender: Contact
}

const generateXML = ({
  fileId,
  partner,
  category,
  mainService,
  additionalServices,
  measures,
  receiver: { address: receiverAddress, ...receiver },
  sender: { address: senderAddress, ...sender },
}: NewShipmentInfo & { partner: string }): string =>
  xmlBuilder.buildObject({
    'soapenv:Envelope': {
      $: {
        'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
        'xmlns:xsd': 'http://service.core.epmx.application.eestipost.ee/xsd',
      },
      'soapenv:Header': '',
      'soapenv:Body': {
        [`xsd:${getMainTag(category)}Request`]: {
          partner,
          interchange: {
            $: { msg_type: 'elsinfov1' },
            header: { $: { sender_cd: partner, file_id: fileId } },
            item_list: {
              item: {
                $: { service: mainService },

                ...(additionalServices && additionalServices.length > 0
                  ? {
                      add_service: {
                        option: additionalServices.map((code) => ({ $: { code } })),
                      },
                    }
                  : {}),

                ...(measures ? { measures: { $: measures } } : {}),

                receiverAddressee: {
                  ...receiver,
                  address: { $: receiverAddress },
                },

                returnAddressee: {
                  ...sender,
                  address: { $: senderAddress },
                },
              },
            },
          },
        },
      },
    },
  })

export const createNewShipment = async (
  { username, password }: { username: string; password: string },
  data: NewShipmentInfo,
): Promise<string> => {
  const xmlRequest = generateXML({ ...data, partner: username })

  console.log(xmlRequest)

  const response = await fetch(FULL_URL, {
    method: 'post',
    body: xmlRequest,
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

  const mainPath = ['Envelope', 'Body', `${getMainTag(data.category)}Response`]

  console.log(JSON.stringify(parsedXML, null, 2))

  if (!response.ok) {
    const message = _.at([...mainPath, 'faultyPacketInfo', 'barcodeInfo', 'message'], _.string)
      .decodeAny(parsedXML)
      .getOrElseValue('')

    const prompt = _.at([...mainPath, 'prompt'], _.string)
      .decodeAny(parsedXML)
      .getOrElseValue('')

    const errorMessage =
      message.length > 0 ? message : prompt.length > 0 ? prompt : response.statusText

    return Promise.reject(errorMessage)
  }

  const [barcode, errorMessage] = _.at(
    [...mainPath, 'savedPacketInfo', 'barcodeInfo', 'barcode'],
    _.string,
  )
    .decodeAny(parsedXML)
    .cata<[string | null, string]>({
      Ok: (val) => [val, ''],
      Err: (msg) => [null, msg],
    })

  if (barcode === null) return Promise.reject(errorMessage)

  return barcode
}

export default createNewShipment
