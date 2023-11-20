import { config } from 'dotenv'
import populateEnv from 'populate-env'

config()

export let env = {
  PORT: 3000,
}

populateEnv(env, { mode: 'halt' })
