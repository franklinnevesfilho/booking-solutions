import type {
  Appointment,
  AppointmentEmployee,
  Invoice,
  Client,
  ClientHome,
  Job,
  Profile,
} from './models'

import { MergeDeep } from 'type-fest'
import { Database as DatabaseGenerated, Json } from './database.types'

export type Database =  DatabaseGenerated
