import * as _ from 'jsonous'
import Decoder from 'jsonous'
import fetch from 'node-fetch'
import { err, ok } from 'resulty'
import { parseStringPromise as parseString } from 'xml2js'
import xml2js from 'xml2js'

import { CountryCode } from './common'

type LocationType = 'parcel-machine' | 'post-office'

export interface Location {
  /**
   * Unique value for each location.
   * While sending data over web service and the destination is Estonian post office or
   * Omniva parcel machine. Use the number in address@offloadPostcode field.
   * @field zip
   */
  id: string

  /**
   * The name of the Estonian post office or Omniva parcel machine.
   */
  name: string

  /**
   * (0) Parcel machine (all Baltic countries).
   * (1) Post office (post offices are only in Estonia).
   */
  type: LocationType

  /**
   * Country
   * Values EE; LV; LT – use this field to sort the parcel machines by country.
   * While sending data over web service and the destination is Estonian
   * Post office or Omniva parcel machine, use the value in address@country field.
   * @field a0_name
   */
  country: CountryCode

  /**
   * Name of the county or in some cases town.
   * Use this field to sort the parcel machine list.
   * @field a1_name
   */
  county: string

  /**
   * Town/parish
   * @field a2_name
   */
  town: string

  /**
   * Village
   * @field a3_name
   */
  village: string

  /**
   * Small place
   * @field a4_name
   */
  smallPlace: string

  /**
   * Street
   * @field a5_name
   */
  street: string

  /**
   * Area
   * @field a6_name
   */
  area: string

  /**
   * House number
   * @field a7_name
   */
  house: string

  /**
   * Apartment no
   * @field a8_name
   */
  apartment: string

  /**
   * the X coordinate to show locations in local map.
   */
  x_coordinate: string

  /**
   * the Y coordinate to show locations in local map.
   */
  y_coordinate: string
}

export const locationDecoder: Decoder<Location> = _.succeed({})
  .assign('id', _.field('zip', _.string))
  .assign('name', _.field('name', _.string))
  .assign(
    'type',
    _.field(
      'type',
      new Decoder<LocationType>((value: unknown) =>
        value === '0'
          ? ok('parcel-machine')
          : value === '1'
          ? ok('post-office')
          : err('expected 1 or 0'),
      ),
    ),
  )
  .assign(
    'country',
    _.field(
      'a0_name',
      new Decoder<CountryCode>((value: unknown) =>
        value === 'LT' || value === 'LV' || value === 'EE'
          ? ok(value)
          : err('expected LT, LV, or EE'),
      ),
    ),
  )
  .assign('county', _.field('a1_name', _.string))
  .assign('town', _.field('a2_name', _.string))
  .assign('village', _.field('a3_name', _.string))
  .assign('smallPlace', _.field('a4_name', _.string))
  .assign('street', _.field('a5_name', _.string))
  .assign('area', _.field('a6_name', _.string))
  .assign('house', _.field('a7_name', _.string))
  .assign('apartment', _.field('a8_name', _.string))
  .assign('x_coordinate', _.field('x_coordinate', _.string))
  .assign('y_coordinate', _.field('y_coordinate', _.string))

export const getLocations = async (): Promise<Location[]> => {
  const response = await fetch('https://www.omniva.ee/locations.xml')

  if (!response.ok) return Promise.reject(response.statusText)

  const xml = await response.text()

  const parsedXML: unknown = await parseString(xml, {
    trim: true,
    explicitArray: false,
    normalizeTags: true,
    ignoreAttrs: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  })

  const [locations, errorMessage] = _.at(['locations', 'location'], _.array(locationDecoder))
    .decodeAny(parsedXML)
    .cata<[Location[] | null, string]>({
      Ok: (val) => [val, ''],
      Err: (msg) => [null, msg],
    })

  if (locations === null) return Promise.reject(errorMessage)

  return locations
}
