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

// ISO 2-letter to name mapping
const COUNTRY_DATA: Record<string, { name: string; iso3: string }> = {
    AF: { name: 'Afghanistan', iso3: 'AFG' },
    AL: { name: 'Albania', iso3: 'ALB' },
    DZ: { name: 'Algeria', iso3: 'DZA' },
    AD: { name: 'Andorra', iso3: 'AND' },
    AO: { name: 'Angola', iso3: 'AGO' },
    AR: { name: 'Argentina', iso3: 'ARG' },
    AM: { name: 'Armenia', iso3: 'ARM' },
    AU: { name: 'Australia', iso3: 'AUS' },
    AT: { name: 'Austria', iso3: 'AUT' },
    AZ: { name: 'Azerbaijan', iso3: 'AZE' },
    BD: { name: 'Bangladesh', iso3: 'BGD' },
    BY: { name: 'Belarus', iso3: 'BLR' },
    BE: { name: 'Belgium', iso3: 'BEL' },
    BR: { name: 'Brazil', iso3: 'BRA' },
    BG: { name: 'Bulgaria', iso3: 'BGR' },
    CA: { name: 'Canada', iso3: 'CAN' },
    CL: { name: 'Chile', iso3: 'CHL' },
    CN: { name: 'China', iso3: 'CHN' },
    CO: { name: 'Colombia', iso3: 'COL' },
    HR: { name: 'Croatia', iso3: 'HRV' },
    CZ: { name: 'Czechia', iso3: 'CZE' },
    DK: { name: 'Denmark', iso3: 'DNK' },
    EG: { name: 'Egypt', iso3: 'EGY' },
    EE: { name: 'Estonia', iso3: 'EST' },
    FI: { name: 'Finland', iso3: 'FIN' },
    FR: { name: 'France', iso3: 'FRA' },
    DE: { name: 'Germany', iso3: 'DEU' },
    GR: { name: 'Greece', iso3: 'GRC' },
    HK: { name: 'Hong Kong', iso3: 'HKG' },
    HU: { name: 'Hungary', iso3: 'HUN' },
    IN: { name: 'India', iso3: 'IND' },
    ID: { name: 'Indonesia', iso3: 'IDN' },
    IR: { name: 'Iran', iso3: 'IRN' },
    IQ: { name: 'Iraq', iso3: 'IRQ' },
    IE: { name: 'Ireland', iso3: 'IRL' },
    IL: { name: 'Israel', iso3: 'ISR' },
    IT: { name: 'Italy', iso3: 'ITA' },
    JP: { name: 'Japan', iso3: 'JPN' },
    KZ: { name: 'Kazakhstan', iso3: 'KAZ' },
    KE: { name: 'Kenya', iso3: 'KEN' },
    KR: { name: 'South Korea', iso3: 'KOR' },
    KW: { name: 'Kuwait', iso3: 'KWT' },
    LV: { name: 'Latvia', iso3: 'LVA' },
    LT: { name: 'Lithuania', iso3: 'LTU' },
    MY: { name: 'Malaysia', iso3: 'MYS' },
    MX: { name: 'Mexico', iso3: 'MEX' },
    MA: { name: 'Morocco', iso3: 'MAR' },
    NL: { name: 'Netherlands', iso3: 'NLD' },
    NZ: { name: 'New Zealand', iso3: 'NZL' },
    NG: { name: 'Nigeria', iso3: 'NGA' },
    NO: { name: 'Norway', iso3: 'NOR' },
    PK: { name: 'Pakistan', iso3: 'PAK' },
    PE: { name: 'Peru', iso3: 'PER' },
    PH: { name: 'Philippines', iso3: 'PHL' },
    PL: { name: 'Poland', iso3: 'POL' },
    PT: { name: 'Portugal', iso3: 'PRT' },
    QA: { name: 'Qatar', iso3: 'QAT' },
    RO: { name: 'Romania', iso3: 'ROU' },
    RU: { name: 'Russia', iso3: 'RUS' },
    SA: { name: 'Saudi Arabia', iso3: 'SAU' },
    RS: { name: 'Serbia', iso3: 'SRB' },
    SG: { name: 'Singapore', iso3: 'SGP' },
    SK: { name: 'Slovakia', iso3: 'SVK' },
    SI: { name: 'Slovenia', iso3: 'SVN' },
    ZA: { name: 'South Africa', iso3: 'ZAF' },
    ES: { name: 'Spain', iso3: 'ESP' },
    SE: { name: 'Sweden', iso3: 'SWE' },
    CH: { name: 'Switzerland', iso3: 'CHE' },
    TW: { name: 'Taiwan', iso3: 'TWN' },
    TH: { name: 'Thailand', iso3: 'THA' },
    TR: { name: 'Turkey', iso3: 'TUR' },
    UA: { name: 'Ukraine', iso3: 'UKR' },
    AE: { name: 'United Arab Emirates', iso3: 'ARE' },
    GB: { name: 'United Kingdom', iso3: 'GBR' },
    US: { name: 'United States', iso3: 'USA' },
    VN: { name: 'Vietnam', iso3: 'VNM' },
    // Common aliases
    UK: { name: 'United Kingdom', iso3: 'GBR' },
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
        let iso2 = props.ISO_A2;
        if (!iso2 && props.ISO_A3) {
            iso2 = ISO3_TO_ISO2[props.ISO_A3];
        }

        // Fallback: try to find by name
        if (!iso2) {
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
                    scale: 120,
                    center: [0, 30],
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
            <div className="absolute bottom-4 left-4 bg-background/90 border border-border rounded-lg p-3">
                <div className="text-[10px] font-medium text-secondary uppercase tracking-wider mb-2">Violations</div>
                <div className="flex items-center gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded border border-border" style={{ backgroundColor: 'rgb(var(--surface))' }} />
                        <span className="text-secondary">0</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#fef3c7' }} />
                        <span className="text-secondary">1-5</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#fbbf24' }} />
                        <span className="text-secondary">6-15</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }} />
                        <span className="text-secondary">16-30</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
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
