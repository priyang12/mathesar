import type { DerivedOptions } from './options';
import { getDerivedOptions } from './options';
import { forceAsciiMinusSign } from './cleaners';

type Parts = Intl.NumberFormatPart[];

function factoryToAddTrailingDecimalSeparator(
  opts: Pick<DerivedOptions, 'decimalSeparator'>,
): (parts: Parts) => Parts {
  return (parts: Parts) =>
    parts.some((p) => p.type === 'decimal')
      ? parts
      : [...parts, { type: 'decimal', value: opts.decimalSeparator }];
}

function combineParts(parts: Parts): string {
  return parts.map((part) => part.value).join('');
}

export function makeFormatter(
  opts: DerivedOptions,
): (value: number | bigint) => string {
  function getValidationErrors(value: number | bigint) {
    if (Number.isNaN(value)) {
      return ['Value is NaN.'];
    }
    if (!opts.allowNegative && (value < 0 || Object.is(value, -0))) {
      return ['Value must be positive.'];
    }
    if (!opts.allowFloat && typeof value === 'number' && value % 1 !== 0) {
      return ['Value must be an integer.'];
    }
    return [];
  }

  function format(value: number | bigint): string {
    const validationErrors = getValidationErrors(value);
    if (validationErrors.length) {
      throw new Error(`Unable to format value. ${validationErrors.join(', ')}`);
    }
    const parts = Intl.NumberFormat(opts.locale, {
      // Override the numbering system which is inferred from the locale so that
      // we don't end up with 1.2 formatted as "১.২", "۱٫۲", or "१.२". Users
      // need to be able to enter numbers in the same format which they are
      // displayed, and we don't yet have support to accept entry of numbers in
      // Bengali, Persian, or Marathi.
      numberingSystem: 'latn',
      minimumFractionDigits: opts.minimumFractionDigits,
      // @ts-ignore because TypeScript's Intl.NumberFormatOptions is not up-to-date
      useGrouping: opts.useGrouping,
      // 20 is the max allowed by the spec. The default is 3. We set this to
      // avoid rounding.
      maximumFractionDigits: 20,
    }).formatToParts(value);

    const polishers = [];
    if (opts.forceTrailingDecimal) {
      polishers.push(factoryToAddTrailingDecimalSeparator(opts));
    }
    const polishedParts = polishers.reduce((acc, polish) => polish(acc), parts);
    const combinedParts = combineParts(polishedParts);

    // Intl.NumberFormat will use a Unicode minus sign for some locales (e.g.
    // 'li'). We are assuming users in those regions won't mind having an ASCII
    // minus sign instead.
    return forceAsciiMinusSign(combinedParts);
  }

  return format;
}

export function formatToNormalizedForm(value: number | bigint): string {
  return makeFormatter(
    getDerivedOptions({
      locale: 'en-US',
      allowFloat: true,
      allowNegative: true,
      useGrouping: false,
      minimumFractionDigits: 0,
      forceTrailingDecimal: false,
    }),
  )(value);
}

/**
 * This is to be used only as a fallback option when we need to format the
 * number in oder to meet the locale requirements, but we don't have a number or
 * bigint because the source is a high precision float.
 */
export function factoryToFormatSimplifiedInputForLocale(
  opts: Pick<DerivedOptions, 'decimalSeparator'>,
): (simplifiedInput: string) => string {
  return (simplifiedInput: string) =>
    simplifiedInput.replace(/\./g, opts.decimalSeparator);
}
