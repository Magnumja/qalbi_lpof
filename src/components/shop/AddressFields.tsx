import type { Address } from './types';
export const readAddress = (form: FormData): Address => ({
  name: String(form.get('name')),
  line1: String(form.get('line1')),
  city: String(form.get('city')),
  postal_code: String(form.get('postal_code')),
  country: String(form.get('country')),
});
export default function AddressFields({
  name,
  countries,
}: {
  name: string;
  countries: string[];
}) {
  return (
    <fieldset className="shop-address">
      <legend>¿Dónde llegará tu pieza?</legend>
      <label>
        Nombre de quien recibe
        <input
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={100}
          autoComplete="shipping name"
        />
      </label>
      <label>
        Dirección completa
        <input
          name="line1"
          required
          minLength={3}
          maxLength={200}
          autoComplete="shipping address-line1"
        />
      </label>
      <div className="shop-form-row">
        <label>
          Ciudad
          <input
            name="city"
            required
            minLength={2}
            maxLength={100}
            autoComplete="shipping address-level2"
          />
        </label>
        <label>
          Código postal
          <input
            name="postal_code"
            required
            minLength={2}
            maxLength={20}
            autoComplete="shipping postal-code"
          />
        </label>
      </div>
      <label>
        País
        <select name="country" autoComplete="shipping country">
          {countries.map((country) => (
            <option key={country} value={country}>
              {new Intl.DisplayNames(['es'], { type: 'region' }).of(country) ??
                country}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
