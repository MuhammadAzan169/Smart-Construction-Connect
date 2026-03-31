import json
import re
from collections import defaultdict

def analyze_email_domains(file_path):
    """
    Analyze email domains to identify potential duplicate or related companies
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
    
    print("EMAIL DOMAIN ANALYSIS")
    print("=" * 80)
    
    # Group companies by email domain
    domain_groups = defaultdict(list)
    
    for company in data:
        company_id = company.get('company_id', 'N/A')
        company_name = company.get('company_name', 'N/A')
        email = company.get('contact', {}).get('email', '')
        
        if email and '@' in email:
            domain = email.split('@')[1]
            domain_groups[domain].append({
                'company_id': company_id,
                'company_name': company_name,
                'email': email
            })
    
    # Print domain groups with more than 1 company
    multi_company_domains = {k: v for k, v in domain_groups.items() if len(v) > 1}
    
    print(f"Total unique email domains: {len(domain_groups)}")
    print(f"Domains with multiple companies: {len(multi_company_domains)}")
    print("\n" + "=" * 80)
    
    for domain, companies in multi_company_domains.items():
        print(f"\nDomain: {domain} ({len(companies)} companies)")
        print("-" * 40)
        
        # Check if companies have similar names
        names = [c['company_name'] for c in companies]
        ids = [c['company_id'] for c in companies]
        
        # Try to detect patterns
        name_patterns = detect_name_patterns(names)
        
        print(f"Company IDs: {', '.join(ids)}")
        print(f"Company Names: {', '.join(names)}")
        
        if name_patterns:
            print(f"Detected pattern: {name_patterns}")
        
        # Check for other similarities
        similar_companies = check_similarities(data, ids)
        if similar_companies:
            print("Potential duplicates found (similar characteristics):")
            for info in similar_companies:
                print(f"  - {info}")
        
        print()
    
    return domain_groups

def detect_name_patterns(names):
    """
    Detect patterns in company names
    """
    if len(names) < 2:
        return None
    
    # Check for numbered companies (Company 1, Company 2, etc.)
    if all(re.search(r'\d+', name) for name in names):
        return "Numbered companies"
    
    # Check for common base name
    words_list = [name.lower().split() for name in names]
    common_words = set(words_list[0])
    
    for words in words_list[1:]:
        common_words.intersection_update(words)
    
    if len(common_words) > 0:
        return f"Common words: {', '.join(common_words)}"
    
    return None

def check_similarities(data, company_ids):
    """
    Check for similarities between companies sharing the same domain
    """
    similarities = []
    
    # Get companies by ID
    companies = [c for c in data if c.get('company_id') in company_ids]
    
    if len(companies) < 2:
        return similarities
    
    # Compare first company with others
    ref_company = companies[0]
    
    for company in companies[1:]:
        similar_traits = []
        
        # Compare operational areas
        ref_cities = set(ref_company.get('operational_areas', {}).keys())
        cmp_cities = set(company.get('operational_areas', {}).keys())
        
        if ref_cities == cmp_cities:
            similar_traits.append("Same operational cities")
        
        # Compare services
        ref_services = set(ref_company.get('services', {}).get('construction', []))
        cmp_services = set(company.get('services', {}).get('construction', []))
        
        if ref_services == cmp_services:
            similar_traits.append("Same construction services")
        
        # Compare experience range
        ref_exp = ref_company.get('experience', {}).get('total_projects', 0)
        cmp_exp = company.get('experience', {}).get('total_projects', 0)
        
        if abs(ref_exp - cmp_exp) <= 50:  # Within 50 projects
            similar_traits.append("Similar project count")
        
        # Compare pricing (using first area/phase as sample)
        ref_price = extract_sample_price(ref_company)
        cmp_price = extract_sample_price(company)
        
        if ref_price and cmp_price and abs(ref_price - cmp_price) <= 100:
            similar_traits.append("Similar pricing")
        
        if similar_traits:
            similarities.append(f"{company.get('company_id')}: {', '.join(similar_traits)}")
    
    return similarities

def extract_sample_price(company):
    """
    Extract a sample price from company data
    """
    operational_areas = company.get('operational_areas', {})
    
    if not operational_areas:
        return None
    
    # Get first city
    first_city = next(iter(operational_areas.values()))
    if not isinstance(first_city, dict):
        return None
    
    # Get first area
    first_area = next(iter(first_city.values()))
    if not isinstance(first_area, dict):
        return None
    
    # Get first sub-area
    first_subarea = next(iter(first_area.values()))
    if not isinstance(first_subarea, dict):
        return None
    
    # Get standard price
    standard_price = first_subarea.get('standard', '0 PKR/sq ft')
    
    # Extract numeric value
    match = re.search(r'(\d+(\.\d+)?)', standard_price)
    if match:
        return float(match.group(1))
    
    return None

def suggest_fixes(data, domain_groups):
    """
    Suggest fixes for domain sharing issues
    """
    print("\n" + "=" * 80)
    print("FIX SUGGESTIONS")
    print("=" * 80)
    
    multi_company_domains = {k: v for k, v in domain_groups.items() if len(v) > 1}
    
    for domain, companies in multi_company_domains.items():
        print(f"\nDomain: {domain}")
        
        if domain == 'gmail.com':
            print("  Issue: Using free email service (gmail.com) for multiple businesses")
            print("  Fix: Each company should have its own professional domain")
            print("  Suggestions:")
            for company in companies:
                base_name = company['company_name'].lower().replace(' ', '')
                print(f"    {company['company_id']}: contact@{base_name}.com")
        
        elif 'karachibuilders.com' in domain:
            print("  Issue: Multiple Karachi companies sharing same domain")
            print("  Possible scenarios:")
            print("  1. These are branch offices of same parent company")
            print("  2. These are separate companies that should have unique domains")
            print("  3. These are duplicate entries")
            print("  Fix suggestions:")
            for company in companies:
                city = get_company_city(data, company['company_id'])
                if city:
                    print(f"    {company['company_id']}: info@{city.lower()}builders.com")
                else:
                    print(f"    {company['company_id']}: info@{company['company_id'].lower()}.com")
        
        elif 'lahoreelite.com' in domain:
            print("  Issue: Multiple Lahore companies sharing same domain")
            print("  Suggested unique domains:")
            for company in companies:
                area = get_company_primary_area(data, company['company_id'])
                if area:
                    print(f"    {company['company_id']}: contact@{area.lower()}constructions.com")
                else:
                    print(f"    {company['company_id']}: info@elite{company['company_id'][-3:]}.com")
        
        elif 'peshawarbuild.com' in domain:
            print("  Issue: Multiple Peshawar companies sharing same domain")
            print("  Suggested unique domains:")
            for company in companies:
                specialty = get_company_specialty(data, company['company_id'])
                if specialty:
                    print(f"    {company['company_id']}: info@{specialty.lower()}builders.com")
                else:
                    print(f"    {company['company_id']}: contact@peshawar{company['company_id'][-3:]}.com")

def get_company_city(data, company_id):
    """
    Get primary city for a company
    """
    company = next((c for c in data if c.get('company_id') == company_id), None)
    if company:
        operational_areas = company.get('operational_areas', {})
        if operational_areas:
            return next(iter(operational_areas.keys()), None)
    return None

def get_company_primary_area(data, company_id):
    """
    Get primary area for a company
    """
    company = next((c for c in data if c.get('company_id') == company_id), None)
    if company:
        operational_areas = company.get('operational_areas', {})
        if operational_areas:
            first_city = next(iter(operational_areas.values()), {})
            if isinstance(first_city, dict):
                return next(iter(first_city.keys()), None)
    return None

def get_company_specialty(data, company_id):
    """
    Get company specialty
    """
    company = next((c for c in data if c.get('company_id') == company_id), None)
    if company:
        specializations = company.get('experience', {}).get('specializations', [])
        if specializations:
            # Clean up specialization name
            spec = specializations[0].replace('_', '')
            return spec
    return None

def apply_email_fixes(file_path, output_path):
    """
    Apply suggested email fixes to create a new file
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
    
    # Define mapping for fixes based on patterns
    domain_fixes = {
        'karachibuilders.com': '{}builders.com',
        'lahoreelite.com': '{}constructions.com',
        'peshawarbuild.com': 'peshawar{}.com',
        'gmail.com': '{}.com'
    }
    
    # Track which companies have been processed
    processed_companies = set()
    
    for company in data:
        company_id = company.get('company_id')
        if company_id in processed_companies:
            continue
        
        email = company.get('contact', {}).get('email', '')
        if email and '@' in email:
            domain = email.split('@')[1]
            
            if domain in domain_fixes:
                # Generate new domain
                if domain == 'gmail.com':
                    # Use company name for gmail addresses
                    base_name = company['company_name'].lower().replace(' ', '').replace('&', 'and')
                    new_domain = domain_fixes[domain].format(base_name)
                else:
                    # Use company ID number for others
                    company_num = company_id.split('-')[1]
                    new_domain = domain_fixes[domain].format(company_num)
                
                # Update email
                local_part = email.split('@')[0]
                company['contact']['email'] = f"{local_part}@{new_domain}"
                
                # Update website if it exists and matches the pattern
                website = company.get('contact', {}).get('website', '')
                if website and domain in website:
                    company['contact']['website'] = website.replace(domain, new_domain)
        
        processed_companies.add(company_id)
    
    # Save to new file
    with open(output_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=2, ensure_ascii=False)
    
    print(f"\nFixed file saved to: {output_path}")
    print(f"Total companies updated: {len(processed_companies)}")

def generate_unique_emails_report(data):
    """
    Generate a report with unique email suggestions
    """
    print("\n" + "=" * 80)
    print("UNIQUE EMAIL SUGGESTIONS")
    print("=" * 80)
    
    for company in data:
        company_id = company.get('company_id')
        company_name = company.get('company_name')
        current_email = company.get('contact', {}).get('email', '')
        
        # Generate unique email based on company name
        clean_name = company_name.lower().replace(' ', '').replace('&', 'and').replace(',', '').replace('.', '')
        
        # Keep only alphanumeric characters
        clean_name = re.sub(r'[^a-z0-9]', '', clean_name)
        
        # Ensure name is not too long
        if len(clean_name) > 20:
            clean_name = clean_name[:20]
        
        # Add company ID if name is too short
        if len(clean_name) < 5:
            clean_name = clean_name + company_id.replace('-', '')
        
        suggested_email = f"contact@{clean_name}.com"
        
        print(f"\n{company_id}: {company_name}")
        print(f"  Current: {current_email}")
        print(f"  Suggested: {suggested_email}")
        
        # Also suggest alternative based on specialty
        specialty = get_company_specialty(data, company_id)
        if specialty:
            alt_email = f"info@{specialty.lower()}builders.com"
            print(f"  Alternative: {alt_email}")

if __name__ == "__main__":
    input_file = "C:/Users/muham/OneDrive/Desktop/Contruction AI/Contruction Company.json"
    output_file = "C:/Users/muham/OneDrive/Desktop/Contruction AI/Contruction Company_Fixed.json"
    
    try:
        # 1. First analyze the current email domain situation
        with open(input_file, 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        domain_groups = analyze_email_domains(input_file)
        
        # 2. Check for other potential issues
        suggest_fixes(data, domain_groups)
        
        # 3. Generate unique email suggestions
        generate_unique_emails_report(data)
        
        print("\n" + "=" * 80)
        print("APPLYING FIXES")
        print("=" * 80)
        
        # 4. Ask user if they want to apply fixes
        response = input("\nDo you want to apply these fixes? (yes/no): ").lower()
        
        if response in ['yes', 'y']:
            # 5. Apply fixes and create new file
            apply_email_fixes(input_file, output_file)
            
            print("\n" + "=" * 80)
            print("VERIFICATION")
            print("=" * 80)
            
            # 6. Verify the fixes
            with open(output_file, 'r', encoding='utf-8') as file:
                fixed_data = json.load(file)
            
            # Check email uniqueness in fixed file
            email_domains = defaultdict(list)
            for company in fixed_data:
                email = company.get('contact', {}).get('email', '')
                if email and '@' in email:
                    domain = email.split('@')[1]
                    email_domains[domain].append(company.get('company_id'))
            
            # Count domains with multiple companies
            multi_domain_count = sum(1 for ids in email_domains.values() if len(ids) > 1)
            
            print(f"\nVerification Results:")
            print(f"Total unique email domains: {len(email_domains)}")
            print(f"Domains still shared by multiple companies: {multi_domain_count}")
            
            if multi_domain_count > 0:
                print("\nRemaining shared domains:")
                for domain, ids in email_domains.items():
                    if len(ids) > 1:
                        print(f"  {domain}: {', '.join(ids)}")
            else:
                print("\n✓ All companies now have unique email domains!")
                
        else:
            print("\nFixes not applied. Original file remains unchanged.")
            
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()