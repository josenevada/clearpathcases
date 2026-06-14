import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';

const stateDmvPortals: Record<string, { url: string; name: string; note: string }> = {
  AL: { name: 'Alabama', url: 'https://www.alabamainteractive.org/dor/mvLicenseRenewal', note: 'Look for "Vehicle Registration" under MyDMV' },
  AK: { name: 'Alaska', url: 'https://dmv.alaska.gov/', note: 'Look for "Registration" services' },
  AZ: { name: 'Arizona', url: 'https://azmvdnow.gov/', note: 'Look for "Vehicle Registration" under MVD Now' },
  AR: { name: 'Arkansas', url: 'https://www.dfa.arkansas.gov/motor-vehicle/', note: 'Look for "Registration Renewal"' },
  CA: { name: 'California', url: 'https://www.dmv.ca.gov/', note: 'Look for "Registration" under Vehicle Services' },
  CO: { name: 'Colorado', url: 'https://dmv.colorado.gov/', note: 'Look for "Vehicle Registration"' },
  CT: { name: 'Connecticut', url: 'https://portal.ct.gov/dmv', note: 'Look for "Reprint Registration"' },
  DE: { name: 'Delaware', url: 'https://www.dmv.de.gov/', note: 'Look for "Vehicle Services"' },
  FL: { name: 'Florida', url: 'https://www.flhsmv.gov/', note: 'Look for "Vehicle Registration"' },
  GA: { name: 'Georgia', url: 'https://dor.georgia.gov/motor-vehicles', note: 'Look for "Registration" on DRIVES portal' },
  HI: { name: 'Hawaii', url: 'https://hidot.hawaii.gov/highways/vehicle-registration/', note: 'Handled by county — find your county link here' },
  ID: { name: 'Idaho', url: 'https://itd.idaho.gov/itddmv/', note: 'Look for "Vehicle Registration"' },
  IL: { name: 'Illinois', url: 'https://www.ilsos.gov/departments/vehicles/home.html', note: 'Look for "Vehicle Registration"' },
  IN: { name: 'Indiana', url: 'https://www.in.gov/bmv/', note: 'Look for "Registration" services' },
  IA: { name: 'Iowa', url: 'https://www.iowadot.gov/mvd', note: 'Look for "Vehicle Registration"' },
  KS: { name: 'Kansas', url: 'https://www.ksrevenue.gov/dovvehicles.html', note: 'Look for "Registration"' },
  KY: { name: 'Kentucky', url: 'https://drive.ky.gov/Pages/default.aspx', note: 'Registration is handled by your County Clerk' },
  LA: { name: 'Louisiana', url: 'https://www.expresslane.dps.louisiana.gov/', note: 'Look for "Vehicle Registration"' },
  ME: { name: 'Maine', url: 'https://www.maine.gov/sos/bmv/', note: 'Look for "Registration" services' },
  MD: { name: 'Maryland', url: 'https://mva.maryland.gov/', note: 'Look for "Vehicle Registration"' },
  MA: { name: 'Massachusetts', url: 'https://www.mass.gov/orgs/massachusetts-rmv', note: 'Look for "Registration" under RMV services' },
  MI: { name: 'Michigan', url: 'https://www.michigan.gov/sos', note: 'Look for "Vehicle Registration"' },
  MN: { name: 'Minnesota', url: 'https://dvs.dps.mn.gov/', note: 'Look for "Vehicle Registration"' },
  MS: { name: 'Mississippi', url: 'https://www.dor.ms.gov/vehicles', note: 'Look for "Registration Renewal"' },
  MO: { name: 'Missouri', url: 'https://dor.mo.gov/motor-vehicle/', note: 'Look for "Registration"' },
  MT: { name: 'Montana', url: 'https://dojmt.gov/driving/vehicle-registration/', note: 'Look for "Vehicle Registration"' },
  NE: { name: 'Nebraska', url: 'https://dmv.nebraska.gov/', note: 'Look for "Vehicle Registration"' },
  NV: { name: 'Nevada', url: 'https://dmv.nv.gov/', note: 'Look for "Registration" under MyDMV' },
  NH: { name: 'New Hampshire', url: 'https://www.dmv.nh.gov/', note: 'Look for "Registration"' },
  NJ: { name: 'New Jersey', url: 'https://www.nj.gov/mvc/', note: 'Look for "Vehicle Registration"' },
  NM: { name: 'New Mexico', url: 'https://www.mvd.newmexico.gov/', note: 'Look for "Registration"' },
  NY: { name: 'New York', url: 'https://dmv.ny.gov/', note: 'Look for "Registration" under MyDMV' },
  NC: { name: 'North Carolina', url: 'https://www.ncdot.gov/dmv', note: 'Look for "Vehicle Registration"' },
  ND: { name: 'North Dakota', url: 'https://www.dot.nd.gov/divisions/mvd/', note: 'Look for "Registration"' },
  OH: { name: 'Ohio', url: 'https://oplates.com/', note: 'Look for "Print Registration"' },
  OK: { name: 'Oklahoma', url: 'https://oklahoma.gov/service-oklahoma/motor-vehicle.html', note: 'Look for "Registration"' },
  OR: { name: 'Oregon', url: 'https://www.oregon.gov/odot/dmv/', note: 'Look for "Vehicle Registration"' },
  PA: { name: 'Pennsylvania', url: 'https://www.dmv.pa.gov/', note: 'Look for "Vehicle Registration"' },
  RI: { name: 'Rhode Island', url: 'https://dmv.ri.gov/', note: 'Look for "Online Services" → Registration' },
  SC: { name: 'South Carolina', url: 'https://www.scdmvonline.com/', note: 'Look for "Vehicle Registration"' },
  SD: { name: 'South Dakota', url: 'https://dor.sd.gov/individuals/motor-vehicles/', note: 'Look for "Registration"' },
  TN: { name: 'Tennessee', url: 'https://www.tn.gov/safety/driver-services.html', note: 'Look for "Vehicle Registration"' },
  TX: { name: 'Texas', url: 'https://www.txdmv.gov/', note: 'Look for "Registration"' },
  UT: { name: 'Utah', url: 'https://dmv.utah.gov/', note: 'Look for "Vehicle Registration"' },
  VT: { name: 'Vermont', url: 'https://dmv.vermont.gov/', note: 'Look for "Registration"' },
  VA: { name: 'Virginia', url: 'https://www.dmv.virginia.gov/', note: 'Look for "Vehicle Registration"' },
  WA: { name: 'Washington', url: 'https://www.dol.wa.gov/', note: 'Look for "Vehicles" → Registration' },
  WV: { name: 'West Virginia', url: 'https://transportation.wv.gov/DMV/', note: 'Look for "Vehicle Registration"' },
  WI: { name: 'Wisconsin', url: 'https://wisconsindot.gov/Pages/dmv/default.aspx', note: 'Look for "Vehicle Registration"' },
  WY: { name: 'Wyoming', url: 'https://www.dot.state.wy.us/home/dmv.html', note: 'Look for "Registration"' },
  DC: { name: 'Washington DC', url: 'https://dmv.dc.gov/', note: 'Look for "Vehicle Registration"' },
};

interface VehicleRetrievalLinksProps {
  caseId: string;
  clientName: string;
  language?: 'en' | 'es';
}

const VehicleRetrievalLinks = ({ caseId, clientName, language = 'en' }: VehicleRetrievalLinksProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const state = stateDmvPortals[e.target.value];
    if (!state) return;

    window.open(state.url, '_blank', 'noopener,noreferrer');

    // Log activity to Supabase
    supabase.from('activity_log').insert({
      case_id: caseId,
      event_type: 'checkpoint_completed',
      actor_role: 'client',
      actor_name: clientName,
      description: `${clientName} opened DMV portal for ${state.name}`,
    }).then(() => {});
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-primary/80 hover:text-primary transition-colors"
      >
        <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="font-medium">
          {language === 'es' ? 'Obtener este documento ahora' : 'Get this document now'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              <p className="text-sm text-foreground leading-relaxed">
                {language === 'es'
                  ? 'Selecciona tu estado para abrir el portal del DMV donde puedes obtener tu registro de vehículo.'
                  : 'Select your state to open the DMV portal where you can get your vehicle registration.'}
              </p>
              <select
                onChange={handleStateSelect}
                defaultValue=""
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="" disabled>
                  {language === 'es' ? 'Selecciona tu estado...' : 'Select your state...'}
                </option>
                {Object.entries(stateDmvPortals)
                  .sort((a, b) => a[1].name.localeCompare(b[1].name))
                  .map(([code, info]) => (
                    <option key={code} value={code}>
                      {info.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {language === 'es'
                  ? 'Primero revisa la guantera o tu correo electrónico. Si todavía debes dinero por el auto, tu prestamista tiene el título — solo necesitamos tu registro, que tú sí tienes.'
                  : "First check your glove compartment or email. If you're still making car payments, your lender holds the title — we just need your registration, which you do have access to."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VehicleRetrievalLinks;
