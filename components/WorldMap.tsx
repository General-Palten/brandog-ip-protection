/**
 * WorldMap Component
 *
 * Interactive world map using react-simple-maps for displaying
 * violation data by country with hover tooltips and click-to-select.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    ComposableMap,
    Geographies,
    Geography,
} from 'react-simple-maps';
import { InfringementItem } from '../types';

// TopoJSON URL for world map
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ISO 2-letter to name mapping (~195 countries)
const COUNTRY_DATA: Record<string, { name: string; iso3: string }> = {
    AF: { name: 'Afghanistan', iso3: 'AFG' },
    AL: { name: 'Albania', iso3: 'ALB' },
    DZ: { name: 'Algeria', iso3: 'DZA' },
    AD: { name: 'Andorra', iso3: 'AND' },
    AO: { name: 'Angola', iso3: 'AGO' },
    AG: { name: 'Antigua and Barbuda', iso3: 'ATG' },
    AR: { name: 'Argentina', iso3: 'ARG' },
    AM: { name: 'Armenia', iso3: 'ARM' },
    AU: { name: 'Australia', iso3: 'AUS' },
    AT: { name: 'Austria', iso3: 'AUT' },
    AZ: { name: 'Azerbaijan', iso3: 'AZE' },
    BS: { name: 'Bahamas', iso3: 'BHS' },
    BH: { name: 'Bahrain', iso3: 'BHR' },
    BD: { name: 'Bangladesh', iso3: 'BGD' },
    BB: { name: 'Barbados', iso3: 'BRB' },
    BY: { name: 'Belarus', iso3: 'BLR' },
    BE: { name: 'Belgium', iso3: 'BEL' },
    BZ: { name: 'Belize', iso3: 'BLZ' },
    BJ: { name: 'Benin', iso3: 'BEN' },
    BT: { name: 'Bhutan', iso3: 'BTN' },
    BO: { name: 'Bolivia', iso3: 'BOL' },
    BA: { name: 'Bosnia and Herzegovina', iso3: 'BIH' },
    BW: { name: 'Botswana', iso3: 'BWA' },
    BR: { name: 'Brazil', iso3: 'BRA' },
    BN: { name: 'Brunei', iso3: 'BRN' },
    BG: { name: 'Bulgaria', iso3: 'BGR' },
    BF: { name: 'Burkina Faso', iso3: 'BFA' },
    BI: { name: 'Burundi', iso3: 'BDI' },
    CV: { name: 'Cabo Verde', iso3: 'CPV' },
    KH: { name: 'Cambodia', iso3: 'KHM' },
    CM: { name: 'Cameroon', iso3: 'CMR' },
    CA: { name: 'Canada', iso3: 'CAN' },
    CF: { name: 'Central African Republic', iso3: 'CAF' },
    TD: { name: 'Chad', iso3: 'TCD' },
    CL: { name: 'Chile', iso3: 'CHL' },
    CN: { name: 'China', iso3: 'CHN' },
    CO: { name: 'Colombia', iso3: 'COL' },
    KM: { name: 'Comoros', iso3: 'COM' },
    CG: { name: 'Congo', iso3: 'COG' },
    CD: { name: 'Democratic Republic of the Congo', iso3: 'COD' },
    CR: { name: 'Costa Rica', iso3: 'CRI' },
    CI: { name: "Côte d'Ivoire", iso3: 'CIV' },
    HR: { name: 'Croatia', iso3: 'HRV' },
    CU: { name: 'Cuba', iso3: 'CUB' },
    CY: { name: 'Cyprus', iso3: 'CYP' },
    CZ: { name: 'Czechia', iso3: 'CZE' },
    DK: { name: 'Denmark', iso3: 'DNK' },
    DJ: { name: 'Djibouti', iso3: 'DJI' },
    DM: { name: 'Dominica', iso3: 'DMA' },
    DO: { name: 'Dominican Republic', iso3: 'DOM' },
    EC: { name: 'Ecuador', iso3: 'ECU' },
    EG: { name: 'Egypt', iso3: 'EGY' },
    SV: { name: 'El Salvador', iso3: 'SLV' },
    GQ: { name: 'Equatorial Guinea', iso3: 'GNQ' },
    ER: { name: 'Eritrea', iso3: 'ERI' },
    EE: { name: 'Estonia', iso3: 'EST' },
    SZ: { name: 'Eswatini', iso3: 'SWZ' },
    ET: { name: 'Ethiopia', iso3: 'ETH' },
    FJ: { name: 'Fiji', iso3: 'FJI' },
    FI: { name: 'Finland', iso3: 'FIN' },
    FR: { name: 'France', iso3: 'FRA' },
    GA: { name: 'Gabon', iso3: 'GAB' },
    GM: { name: 'Gambia', iso3: 'GMB' },
    GE: { name: 'Georgia', iso3: 'GEO' },
    DE: { name: 'Germany', iso3: 'DEU' },
    GH: { name: 'Ghana', iso3: 'GHA' },
    GR: { name: 'Greece', iso3: 'GRC' },
    GD: { name: 'Grenada', iso3: 'GRD' },
    GT: { name: 'Guatemala', iso3: 'GTM' },
    GN: { name: 'Guinea', iso3: 'GIN' },
    GW: { name: 'Guinea-Bissau', iso3: 'GNB' },
    GY: { name: 'Guyana', iso3: 'GUY' },
    HT: { name: 'Haiti', iso3: 'HTI' },
    HN: { name: 'Honduras', iso3: 'HND' },
    HK: { name: 'Hong Kong', iso3: 'HKG' },
    HU: { name: 'Hungary', iso3: 'HUN' },
    IS: { name: 'Iceland', iso3: 'ISL' },
    IN: { name: 'India', iso3: 'IND' },
    ID: { name: 'Indonesia', iso3: 'IDN' },
    IR: { name: 'Iran', iso3: 'IRN' },
    IQ: { name: 'Iraq', iso3: 'IRQ' },
    IE: { name: 'Ireland', iso3: 'IRL' },
    IL: { name: 'Israel', iso3: 'ISR' },
    IT: { name: 'Italy', iso3: 'ITA' },
    JM: { name: 'Jamaica', iso3: 'JAM' },
    JP: { name: 'Japan', iso3: 'JPN' },
    JO: { name: 'Jordan', iso3: 'JOR' },
    KZ: { name: 'Kazakhstan', iso3: 'KAZ' },
    KE: { name: 'Kenya', iso3: 'KEN' },
    KI: { name: 'Kiribati', iso3: 'KIR' },
    KP: { name: 'North Korea', iso3: 'PRK' },
    KR: { name: 'South Korea', iso3: 'KOR' },
    KW: { name: 'Kuwait', iso3: 'KWT' },
    KG: { name: 'Kyrgyzstan', iso3: 'KGZ' },
    LA: { name: 'Laos', iso3: 'LAO' },
    LV: { name: 'Latvia', iso3: 'LVA' },
    LB: { name: 'Lebanon', iso3: 'LBN' },
    LS: { name: 'Lesotho', iso3: 'LSO' },
    LR: { name: 'Liberia', iso3: 'LBR' },
    LY: { name: 'Libya', iso3: 'LBY' },
    LI: { name: 'Liechtenstein', iso3: 'LIE' },
    LT: { name: 'Lithuania', iso3: 'LTU' },
    LU: { name: 'Luxembourg', iso3: 'LUX' },
    MG: { name: 'Madagascar', iso3: 'MDG' },
    MW: { name: 'Malawi', iso3: 'MWI' },
    MY: { name: 'Malaysia', iso3: 'MYS' },
    MV: { name: 'Maldives', iso3: 'MDV' },
    ML: { name: 'Mali', iso3: 'MLI' },
    MT: { name: 'Malta', iso3: 'MLT' },
    MR: { name: 'Mauritania', iso3: 'MRT' },
    MU: { name: 'Mauritius', iso3: 'MUS' },
    MX: { name: 'Mexico', iso3: 'MEX' },
    MD: { name: 'Moldova', iso3: 'MDA' },
    MC: { name: 'Monaco', iso3: 'MCO' },
    MN: { name: 'Mongolia', iso3: 'MNG' },
    ME: { name: 'Montenegro', iso3: 'MNE' },
    MA: { name: 'Morocco', iso3: 'MAR' },
    MZ: { name: 'Mozambique', iso3: 'MOZ' },
    MM: { name: 'Myanmar', iso3: 'MMR' },
    NA: { name: 'Namibia', iso3: 'NAM' },
    NP: { name: 'Nepal', iso3: 'NPL' },
    NL: { name: 'Netherlands', iso3: 'NLD' },
    NZ: { name: 'New Zealand', iso3: 'NZL' },
    NI: { name: 'Nicaragua', iso3: 'NIC' },
    NE: { name: 'Niger', iso3: 'NER' },
    NG: { name: 'Nigeria', iso3: 'NGA' },
    MK: { name: 'North Macedonia', iso3: 'MKD' },
    NO: { name: 'Norway', iso3: 'NOR' },
    OM: { name: 'Oman', iso3: 'OMN' },
    PK: { name: 'Pakistan', iso3: 'PAK' },
    PA: { name: 'Panama', iso3: 'PAN' },
    PG: { name: 'Papua New Guinea', iso3: 'PNG' },
    PY: { name: 'Paraguay', iso3: 'PRY' },
    PE: { name: 'Peru', iso3: 'PER' },
    PH: { name: 'Philippines', iso3: 'PHL' },
    PL: { name: 'Poland', iso3: 'POL' },
    PT: { name: 'Portugal', iso3: 'PRT' },
    QA: { name: 'Qatar', iso3: 'QAT' },
    RO: { name: 'Romania', iso3: 'ROU' },
    RU: { name: 'Russia', iso3: 'RUS' },
    RW: { name: 'Rwanda', iso3: 'RWA' },
    KN: { name: 'Saint Kitts and Nevis', iso3: 'KNA' },
    LC: { name: 'Saint Lucia', iso3: 'LCA' },
    VC: { name: 'Saint Vincent and the Grenadines', iso3: 'VCT' },
    WS: { name: 'Samoa', iso3: 'WSM' },
    ST: { name: 'Sao Tome and Principe', iso3: 'STP' },
    SA: { name: 'Saudi Arabia', iso3: 'SAU' },
    SN: { name: 'Senegal', iso3: 'SEN' },
    RS: { name: 'Serbia', iso3: 'SRB' },
    SC: { name: 'Seychelles', iso3: 'SYC' },
    SL: { name: 'Sierra Leone', iso3: 'SLE' },
    SG: { name: 'Singapore', iso3: 'SGP' },
    SK: { name: 'Slovakia', iso3: 'SVK' },
    SI: { name: 'Slovenia', iso3: 'SVN' },
    SB: { name: 'Solomon Islands', iso3: 'SLB' },
    SO: { name: 'Somalia', iso3: 'SOM' },
    ZA: { name: 'South Africa', iso3: 'ZAF' },
    SS: { name: 'South Sudan', iso3: 'SSD' },
    ES: { name: 'Spain', iso3: 'ESP' },
    LK: { name: 'Sri Lanka', iso3: 'LKA' },
    SD: { name: 'Sudan', iso3: 'SDN' },
    SR: { name: 'Suriname', iso3: 'SUR' },
    SE: { name: 'Sweden', iso3: 'SWE' },
    CH: { name: 'Switzerland', iso3: 'CHE' },
    SY: { name: 'Syria', iso3: 'SYR' },
    TW: { name: 'Taiwan', iso3: 'TWN' },
    TJ: { name: 'Tajikistan', iso3: 'TJK' },
    TZ: { name: 'Tanzania', iso3: 'TZA' },
    TH: { name: 'Thailand', iso3: 'THA' },
    TL: { name: 'Timor-Leste', iso3: 'TLS' },
    TG: { name: 'Togo', iso3: 'TGO' },
    TO: { name: 'Tonga', iso3: 'TON' },
    TT: { name: 'Trinidad and Tobago', iso3: 'TTO' },
    TN: { name: 'Tunisia', iso3: 'TUN' },
    TR: { name: 'Turkey', iso3: 'TUR' },
    TM: { name: 'Turkmenistan', iso3: 'TKM' },
    UG: { name: 'Uganda', iso3: 'UGA' },
    UA: { name: 'Ukraine', iso3: 'UKR' },
    AE: { name: 'United Arab Emirates', iso3: 'ARE' },
    GB: { name: 'United Kingdom', iso3: 'GBR' },
    US: { name: 'United States', iso3: 'USA' },
    UY: { name: 'Uruguay', iso3: 'URY' },
    UZ: { name: 'Uzbekistan', iso3: 'UZB' },
    VU: { name: 'Vanuatu', iso3: 'VUT' },
    VE: { name: 'Venezuela', iso3: 'VEN' },
    VN: { name: 'Vietnam', iso3: 'VNM' },
    YE: { name: 'Yemen', iso3: 'YEM' },
    ZM: { name: 'Zambia', iso3: 'ZMB' },
    ZW: { name: 'Zimbabwe', iso3: 'ZWE' },
    // Common aliases
    UK: { name: 'United Kingdom', iso3: 'GBR' },
    XK: { name: 'Kosovo', iso3: 'XKX' },
    PS: { name: 'Palestine', iso3: 'PSE' },
    EH: { name: 'Western Sahara', iso3: 'ESH' },
    FK: { name: 'Falkland Islands', iso3: 'FLK' },
    NC: { name: 'New Caledonia', iso3: 'NCL' },
    GF: { name: 'French Guiana', iso3: 'GUF' },
    TF: { name: 'French Southern Territories', iso3: 'ATF' },
    GL: { name: 'Greenland', iso3: 'GRL' },
    PR: { name: 'Puerto Rico', iso3: 'PRI' },
};

// Reverse lookup: ISO3 to ISO2
const ISO3_TO_ISO2: Record<string, string> = Object.entries(COUNTRY_DATA).reduce(
    (acc, [iso2, data]) => {
        acc[data.iso3] = iso2;
        return acc;
    },
    {} as Record<string, string>
);

// Reverse lookup: Country name to ISO2
const NAME_TO_ISO2: Record<string, string> = Object.entries(COUNTRY_DATA).reduce(
    (acc, [iso2, data]) => {
        acc[data.name.toLowerCase()] = iso2;
        return acc;
    },
    {} as Record<string, string>
);

export interface WorldMapProps {
    data: { country: string; value: number }[];
    infringements: InfringementItem[];
    onCountrySelect: (countryCode: string, violations: InfringementItem[]) => void;
    selectedCountry?: string;
}

// Get color based on violation count
function getCountryColor(count: number): string {
    if (count === 0) return 'rgb(var(--surface))';
    if (count <= 5) return '#fef3c7'; // amber-100
    if (count <= 15) return '#fbbf24'; // amber-400
    if (count <= 30) return '#f97316'; // orange-500
    return '#ef4444'; // red-500
}

// Tooltip component
interface TooltipProps {
    content: { name: string; count: number } | null;
    position: { x: number; y: number };
}

const Tooltip: React.FC<TooltipProps> = ({ content, position }) => {
    if (!content) return null;

    return (
        <div
            className="fixed pointer-events-none z-50 px-3 py-2 bg-background border border-border rounded-lg shadow-xl text-sm"
            style={{
                left: position.x + 10,
                top: position.y - 40,
            }}
        >
            <div className="font-medium text-primary">{content.name}</div>
            <div className="text-secondary text-xs font-mono">
                {content.count} violation{content.count !== 1 ? 's' : ''}
            </div>
        </div>
    );
};

const WorldMap: React.FC<WorldMapProps> = ({
    data,
    infringements,
    onCountrySelect,
    selectedCountry,
}) => {
    const [tooltipContent, setTooltipContent] = useState<{ name: string; count: number } | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    // Create a map of country code to violation count
    const countryDataMap = useMemo(() => {
        const map: Record<string, number> = {};
        data.forEach(item => {
            // Normalize country code (handle ISO2, ISO3, and full country names)
            let iso2: string | undefined;
            const country = item.country.trim();

            if (country.length === 2) {
                // Already ISO2
                iso2 = country.toUpperCase();
            } else if (country.length === 3) {
                // ISO3 code
                iso2 = ISO3_TO_ISO2[country.toUpperCase()];
            } else {
                // Full country name
                iso2 = NAME_TO_ISO2[country.toLowerCase()];
            }

            if (iso2 && COUNTRY_DATA[iso2]) {
                map[iso2] = (map[iso2] || 0) + item.value;
            }
        });
        return map;
    }, [data]);

    // Get country info from geography properties
    const getCountryInfo = useCallback((geo: { properties: { name?: string; NAME?: string; ISO_A2?: string; ISO_A3?: string } }) => {
        const props = geo.properties;
        const name = props.name || props.NAME || 'Unknown';

        // Try to get ISO2 code from various properties
        // Note: Natural Earth TopoJSON uses '-99' as a sentinel for missing ISO_A2
        let iso2 = props.ISO_A2;
        if ((!iso2 || iso2 === '-99') && props.ISO_A3) {
            iso2 = ISO3_TO_ISO2[props.ISO_A3];
        }

        // Fallback: try to find by name
        if (!iso2 || iso2 === '-99') {
            const entry = Object.entries(COUNTRY_DATA).find(
                ([, data]) => data.name.toLowerCase() === name.toLowerCase()
            );
            if (entry) {
                iso2 = entry[0];
            }
        }

        return { name, iso2: iso2 || '' };
    }, []);

    const handleMouseEnter = useCallback(
        (geo: { properties: { name?: string; NAME?: string; ISO_A2?: string; ISO_A3?: string } }, event: React.MouseEvent) => {
            const { name, iso2 } = getCountryInfo(geo);
            const count = iso2 ? countryDataMap[iso2] || 0 : 0;
            setTooltipContent({ name, count });
            setTooltipPosition({ x: event.clientX, y: event.clientY });
        },
        [getCountryInfo, countryDataMap]
    );

    const handleMouseMove = useCallback((event: React.MouseEvent) => {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
    }, []);

    const handleMouseLeave = useCallback(() => {
        setTooltipContent(null);
    }, []);

    const handleClick = useCallback(
        (geo: { properties: { name?: string; NAME?: string; ISO_A2?: string; ISO_A3?: string } }) => {
            const { iso2 } = getCountryInfo(geo);
            if (iso2) {
                const violations = infringements.filter(
                    item => item.country.toUpperCase() === iso2.toUpperCase()
                );
                onCountrySelect(iso2, violations);
            }
        },
        [getCountryInfo, infringements, onCountrySelect]
    );

    return (
        <div className="relative w-full h-full bg-background rounded-lg overflow-hidden">
            <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                    scale: 100,
                    center: [0, 35],
                }}
                className="w-full h-full"
            >
                <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                        geographies.map(geo => {
                            const { iso2 } = getCountryInfo(geo);
                            const count = iso2 ? countryDataMap[iso2] || 0 : 0;
                            const isSelected = selectedCountry === iso2;

                            return (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    onMouseEnter={(event) => handleMouseEnter(geo, event)}
                                    onMouseMove={handleMouseMove}
                                    onMouseLeave={handleMouseLeave}
                                    onClick={() => handleClick(geo)}
                                    style={{
                                        default: {
                                            fill: getCountryColor(count),
                                            stroke: isSelected ? 'rgb(var(--primary))' : '#a1a1aa',
                                            strokeWidth: isSelected ? 2 : 0.5,
                                            outline: 'none',
                                            transition: 'all 150ms',
                                        },
                                        hover: {
                                            fill: count > 0 ? '#fde68a' : 'rgb(var(--surface))',
                                            stroke: '#d4d4d8',
                                            strokeWidth: 1,
                                            outline: 'none',
                                            cursor: 'pointer',
                                        },
                                        pressed: {
                                            fill: getCountryColor(count),
                                            stroke: 'rgb(var(--primary))',
                                            strokeWidth: 1,
                                            outline: 'none',
                                        },
                                    }}
                                />
                            );
                        })
                    }
                </Geographies>
            </ComposableMap>

            <Tooltip content={tooltipContent} position={tooltipPosition} />

            {/* Legend */}
            <div className="absolute bottom-2 left-2 bg-background/90 border border-border rounded-md px-2 py-1.5">
                <div className="flex items-center gap-1.5 text-[9px]">
                    <div className="flex items-center gap-0.5">
                        <div className="w-2.5 h-2.5 rounded-sm border border-border" style={{ backgroundColor: 'rgb(var(--surface))' }} />
                        <span className="text-secondary">0</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#fef3c7' }} />
                        <span className="text-secondary">1-5</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#fbbf24' }} />
                        <span className="text-secondary">6-15</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#f97316' }} />
                        <span className="text-secondary">16-30</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                        <span className="text-secondary">31+</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Export utilities for use in other components
export function getCountryName(countryCode: string): string {
    const normalized = countryCode.toUpperCase();
    return COUNTRY_DATA[normalized]?.name || countryCode;
}

export function getCountryFlag(countryCode: string): string {
    // Convert country code to flag emoji using regional indicator symbols
    const normalized = countryCode.toUpperCase();
    if (normalized.length !== 2) return '';

    const codePoints = normalized
        .split('')
        .map(char => 0x1f1e6 + char.charCodeAt(0) - 65);

    return String.fromCodePoint(...codePoints);
}

export default WorldMap;
