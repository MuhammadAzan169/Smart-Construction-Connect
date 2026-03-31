import json
import re
from pathlib import Path

SRC_FILE = Path(__file__).resolve().parent / 'Contruction Company.json'
DST_FILE = Path(__file__).resolve().parent / 'Contruction Company.preprocessed.json'

UNIT_MULTIPLIERS = {
    'm': 1_000_000,
    'mn': 1_000_000,
    'million': 1_000_000,
    'k': 1_000,
    'thousand': 1_000,
    'l': 100_000,
    'lac': 100_000,
    'lakh': 100_000,
}


def parse_number_with_unit(value: str):
    if value is None:
        return None
    text = str(value).strip().lower()
    # remove commas and currency words
    text = text.replace(',', '').replace('pkR', 'pkr').replace('rs.', '')
    text = text.replace('pkr', '').replace('rs', '').strip()

    # if the format is e.g. 4.5m, 3.2m+, 9m+, 18000
    m = re.match(r'^([0-9]+(?:\.[0-9]+)?)([a-z]+)?\+?\s*$', text)
    if m:
        val = float(m.group(1))
        unit = (m.group(2) or '').strip()
        if unit in UNIT_MULTIPLIERS:
            return int(val * UNIT_MULTIPLIERS[unit])
        if unit == 'sqft' or unit == 'sq.ft' or unit == 'sq ft':
            # unexpected pattern, just return numeric part
            return int(val)
        if unit == '':
            return int(val)

    # fallback parse plain float/int
    m2 = re.match(r'^([0-9]+(?:\.[0-9]+)?)$', text)
    if m2:
        return int(float(m2.group(1)))

    # case like 4.5m to 5.2m, handle outside
    return None


def normalize_price_per_sqft(price_text: str):
    if not price_text:
        return None
    s = str(price_text).strip().lower()
    s = s.replace('pk r', 'pkr').replace('sq.ft', 'sq ft').replace('sqft', 'sq ft')
    # find first numeric token
    m = re.search(r'([0-9]+(?:\.[0-9]+)?)', s)
    if not m:
        return None
    return float(m.group(1))


def parse_cost_range(cost_text: str):
    if not cost_text:
        return None
    s = str(cost_text).strip().lower().replace('–', '-').replace('—', '-').replace('\u2013', '-').replace('\u2014', '-')
    s = s.replace('pk r', 'pkr').replace('pkr', '').strip()
    # can be '3.2m  to  3.8m', '6.0m+ ', '10m+', '2.8m - 3.5m'

    if '+' in s and 'to' not in s and '-' not in s:
        maybe = s.replace('+', '').strip()
        min_val = parse_number_with_unit(maybe)
        return {'min': min_val, 'max': None}

    # ranges
    m = re.split(r'\s*(?:to|-|–|—)\s*', s)
    if len(m) == 2:
        min_val = parse_number_with_unit(m[0])
        max_val = parse_number_with_unit(m[1])
        return {'min': min_val, 'max': max_val}

    # fallback individual
    x = parse_number_with_unit(s)
    return {'min': x, 'max': x}


def flatten_operational_areas(ops):
    rows = []
    cities = set()
    areas = set()
    area_full = set()

    for city, area_obj in (ops or {}).items():
        cities.add(city)
        for area, subareas in (area_obj or {}).items():
            for subarea, packages in (subareas or {}).items():
                loc = f'{city}:{area}:{subarea}'
                area_full.add(loc)
                areas.add(area)
                for package_name, price_txt in (packages or {}).items():
                    price_val = normalize_price_per_sqft(price_txt)
                    rows.append({
                        'city': city,
                        'area': area,
                        'subarea': subarea,
                        'location': loc,
                        'package': package_name,
                        'price_per_sqft': price_val,
                        'price_raw': price_txt,
                    })
    return rows, sorted(cities), sorted(areas), sorted(area_full)


def build_summary(company):
    parts = []
    parts.append(company.get('company_name', ''))
    parts.append(f"Established {company.get('legal_info', {}).get('year_established', '')}")

    cc = company.get('construction_capability', {})
    parts.append(f"Plot {cc.get('min_plot_marla', '')}-{cc.get('max_plot_marla', '')} marla")
    parts.append(f"Floors up to {cc.get('max_floors', '')}")
    if cc.get('basement_supported'):
        parts.append('Basement supported')

    parts.append('Services: ' + ', '.join(company.get('services', {}).get('construction', [])))
    parts.append('Approvals: ' + ', '.join(company.get('services', {}).get('approvals_support', [])))

    rating = company.get('customer_feedback', {}).get('average_rating')
    if rating is not None:
        parts.append(f"Rating {rating}/5")

    ai = company.get('ai_scores', {})
    parts.append('AI scores: ' + ', '.join(f"{k}:{v}" for k, v in ai.items()))

    return '. '.join([p for p in parts if p])


def extract_tags(company):
    tags = set()
    tags.update(company.get('services', {}).get('construction', []))
    tags.update(company.get('services', {}).get('extras', []))
    tags.update(company.get('experience', {}).get('specializations', []))
    tags.update(company.get('customer_feedback', {}).get('common_praises', []))
    tags.update(company.get('ideal_customer_profile', {}).get('best_for', []))
    tags.update(company.get('ideal_customer_profile', {}).get('not_ideal_for', []))
    if company.get('construction_capability', {}).get('basement_supported'):
        tags.add('basement_allowed')
    if company.get('customer_feedback', {}).get('average_rating', 0) >= 4.5:
        tags.add('top_rated')
    return sorted({t for t in tags if t})


def preprocess_item(company):
    result = company.copy()

    flat, cities, areas, area_full = flatten_operational_areas(company.get('operational_areas', {}))
    result['flattened_operational_areas'] = flat
    result['cities_served'] = cities
    result['areas_served'] = areas
    result['area_location_keys'] = area_full

    # normalize estimated_total_cost_range
    estimated = {}
    for plot_size, packages in (company.get('estimated_total_cost_range', {}) or {}).items():
        estimated[plot_size] = {}
        for pkg, cost_text in (packages or {}).items():
            estimated[plot_size][pkg] = parse_cost_range(cost_text)

    result['estimated_total_cost_numeric'] = estimated

    # add package rates summary (min max among locations for each package)
    package_rates = {}
    for row in flat:
        pkg = row['package']
        price = row['price_per_sqft']
        if price is None:
            continue
        entr = package_rates.setdefault(pkg, {'min': float('inf'), 'max': 0, 'count': 0})
        entr['min'] = min(entr['min'], price)
        entr['max'] = max(entr['max'], price)
        entr['count'] += 1

    for pkg, entr in package_rates.items():
        if entr['count'] == 0:
            package_rates[pkg] = {'min': None, 'max': None}
        else:
            package_rates[pkg] = {'min': entr['min'], 'max': entr['max'], 'count': entr['count']}

    result['package_rate_stats'] = package_rates

    # derived score with AI and rating
    ai = company.get('ai_scores', {})
    avg_ai = None
    if ai:
        numeric = [v for v in ai.values() if isinstance(v, (int, float))]
        if numeric:
            avg_ai = sum(numeric) / len(numeric)
    result['derived_scores'] = {
        'ai_score_avg': avg_ai,
        'customer_rating': company.get('customer_feedback', {}).get('average_rating'),
    }

    result['unified_text_summary'] = build_summary(company)
    result['search_tags'] = extract_tags(company)

    return result


def run():
    data = json.loads(SRC_FILE.read_text(encoding='utf-8'))
    output = [preprocess_item(item) for item in data]
    DST_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Wrote {len(output)} preprocessed records to {DST_FILE}')


if __name__ == '__main__':
    run()
