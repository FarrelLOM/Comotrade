import 'server-only';
import { JubelioClient, JubelioError } from './jubelio-client-core.mjs';

export { JubelioClient, JubelioError };

let sharedClient;
export function getJubelioClient() {
  sharedClient ||= new JubelioClient();
  return sharedClient;
}
