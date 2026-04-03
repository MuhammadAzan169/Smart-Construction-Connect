// Main Application State
const appState = {
    currentStep: 1,
    totalSteps: 16,
    operationalAreas: [],
    logoDataUrl: null,   // base64 data URL when user uploads a file
    coverDataUrl: null,  // base64 data URL when user uploads a file
    cities: {
        'Karachi': {
            societies: ['DHA', 'Bahria Town', 'Gulshan-e-Iqbal', 'Clifton', 'Saddar', 'North Nazimabad', 'Gulistan-e-Jauhar', 'Malir', 'Korangi', 'Defence'],
            phases: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6', 'Phase 7', 'Phase 8', 'Block A', 'Block B', 'Block C', 'Block D', 'Sector A', 'Sector B']
        },
        'Lahore': {
            societies: ['DHA', 'Bahria Town', 'Model Town', 'Johar Town', 'Garden Town', 'Cantt', 'Faisal Town', 'Wapda Town', 'Gulberg', 'Township'],
            phases: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6', 'Phase 7', 'Phase 8', 'Block A', 'Block B', 'Block C', 'Block D']
        },
        'Islamabad': {
            societies: ['DHA', 'Bahria Town', 'G-9', 'G-10', 'F-6', 'F-7', 'E-7', 'I-8', 'I-10', 'G-11'],
            phases: ['Sector A', 'Sector B', 'Sector C', 'Sector D', 'Sector E', 'Sector F', 'Sector G', 'Block A', 'Block B']
        },
        'Rawalpindi': {
            societies: ['DHA', 'Bahria Town', 'Satellite Town', 'Westridge', 'Askari', 'Chaklala', 'Cantt'],
            phases: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Sector A', 'Sector B']
        },
        'Faisalabad': {
            societies: ['DHA', 'Canal Road', 'Jinnah Colony', 'Madina Town', 'Peoples Colony', 'Satiana Road'],
            phases: ['Phase 1', 'Phase 2', 'Phase 3', 'Block A', 'Block B', 'Sector A']
        },
        'Multan': {
            societies: ['DHA', 'Bahria Town', 'Bosan Road', 'Cantt', 'Shah Rukn-e-Alam'],
            phases: ['Phase 1', 'Phase 2', 'Phase 3', 'Block A', 'Block B']
        },
        'Other': {
            societies: [],
            phases: ['Phase 1', 'Phase 2', 'Phase 3', 'Block A', 'Block B', 'Block C']
        }
    },
    materialBrands: {
        cement: ['Bestway', 'Lucky', 'DG Khan', 'Maple Leaf', 'Attock', 'Cherat', 'Fauji', 'Kohat', 'Other'],
        steel: ['40 Grade', '60 Grade', 'TOR Steel', 'ASTM A615', 'Other'],
        bricks: ['Local Bricks', 'A+ Bricks', 'Cement Blocks', 'Concrete Blocks', 'Hollow Blocks', 'Other'],
        wiring: ['Pak Cable', 'DAWOOD', 'Standard', 'ABB', 'Siemens', 'Other'],
        plumbing: ['Standard', 'Ashir', 'Grohe', 'Kohler', 'Jaquar', 'Other'],
        paint: ['ICI', 'ICI Dulux', 'Berger', 'Nippon', 'Jotun', 'Other']
    }
};

// DOM Elements
const form = document.getElementById('registrationForm');
const progressBar = document.getElementById('progressBar');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    populateYearDropdown();
    initializeOperationalAreas();
    initializePlotSizes();
    setupEventListeners();
    setupPackageTabs();
    setupMaterialsTabs();
    setupTimelineTabs();
    setupMaterialOtherInputs();
    setupLogoUpload();
    setupCoverUpload();
    updateProgressBar();
    
    // Show step 1
    showStep(1);
});

// Initialize plot sizes
function initializePlotSizes() {
    // Add event listener for custom plot size
    const addCustomPlotBtn = document.getElementById('addCustomPlotSize');
    const customPlotInput = document.getElementById('customPlotSize');
    const customPlotList = document.getElementById('customPlotSizesList');
    
    if (addCustomPlotBtn) {
        addCustomPlotBtn.addEventListener('click', function() {
            const customSize = customPlotInput.value.trim();
            if (customSize) {
                addCustomPlotSize(customSize);
                customPlotInput.value = '';
            }
        });
        
        // Allow Enter key to add custom size
        customPlotInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const customSize = customPlotInput.value.trim();
                if (customSize) {
                    addCustomPlotSize(customSize);
                    customPlotInput.value = '';
                }
            }
        });
    }
}

// Add custom plot size
function addCustomPlotSize(size) {
    const customPlotList = document.getElementById('customPlotSizesList');
    const sizeId = 'custom-' + Date.now();
    
    const sizeHTML = `
        <div class="custom-size-item" data-size-id="${sizeId}">
            <label class="checkbox-label">
                <input type="checkbox" name="plotSizes" value="${size}" checked>
                <span>${size}</span>
            </label>
            <button type="button" class="remove-small-btn" onclick="removeCustomPlotSize('${sizeId}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    customPlotList.insertAdjacentHTML('beforeend', sizeHTML);
}

// Remove custom plot size
function removeCustomPlotSize(sizeId) {
    const sizeElement = document.querySelector(`[data-size-id="${sizeId}"]`);
    if (sizeElement) {
        sizeElement.remove();
    }
}

// Setup material select other inputs
function setupMaterialOtherInputs() {
    // Listen for "Other" selection in material selects
    document.querySelectorAll('.material-select').forEach(select => {
        select.addEventListener('change', function() {
            const otherInput = this.nextElementSibling;
            if (this.value === 'Other') {
                otherInput.style.display = 'block';
                otherInput.required = true;
            } else {
                otherInput.style.display = 'none';
                otherInput.required = false;
                otherInput.value = '';
            }
        });
    });
}

// ── PKR / Currency helpers ────────────────────────────────────────────────────

/**
 * Convert a raw PKR number to a human-readable Lakh/Crore string.
 * e.g. 3500000 → "35 Lakh"  |  10000000 → "1 Crore"
 */
function pkrToHumanLabel(amount) {
    if (!amount || isNaN(amount) || amount <= 0) return '';
    const num = parseInt(amount);
    if (num >= 10000000) {
        const crore = (num / 10000000);
        return (Number.isInteger(crore) ? crore : crore.toFixed(2).replace(/\.?0+$/, '')) + ' Crore';
    }
    if (num >= 100000) {
        const lakh = (num / 100000);
        return (Number.isInteger(lakh) ? lakh : lakh.toFixed(2).replace(/\.?0+$/, '')) + ' Lakh';
    }
    return num.toLocaleString('en-PK') + ' PKR';
}

/**
 * Build a cost-range object storing both the bare number and the human label.
 * { pkr: 3500000, label: "35 Lakh" }
 */
function buildCostRangeValue(rawStr) {
    const num = parseInt((rawStr || '').replace(/,/g, '')) || 0;
    return { pkr: num, label: pkrToHumanLabel(num) };
}

// ── HQ City "Other" toggle ────────────────────────────────────────────────────
function setupHqCityToggle() {
    const hqCitySelect = document.getElementById('hqCity');
    if (hqCitySelect) {
        hqCitySelect.addEventListener('change', function() {
            const otherGroup = document.getElementById('hqCityOtherGroup');
            if (otherGroup) {
                otherGroup.style.display = this.value === 'Other' ? 'block' : 'none';
                const otherInput = document.getElementById('hqCityOther');
                if (otherInput) otherInput.required = this.value === 'Other';
            }
        });
    }
}

// ── Logo upload (URL + file) ──────────────────────────────────────────────────
function switchLogoTab(tab) {
    const urlTab = document.getElementById('logoUrlTab');
    const fileTab = document.getElementById('logoFileTab');
    const urlBtn = document.getElementById('logoUrlTabBtn');
    const fileBtn = document.getElementById('logoFileTabBtn');
    if (!urlTab) return;
    if (tab === 'url') {
        urlTab.style.display = 'block';
        fileTab.style.display = 'none';
        urlBtn.classList.add('active');
        fileBtn.classList.remove('active');
    } else {
        urlTab.style.display = 'none';
        fileTab.style.display = 'block';
        fileBtn.classList.add('active');
        urlBtn.classList.remove('active');
    }
}

function setupLogoUpload() {
    setupHqCityToggle();

    const logoUrlInput = document.getElementById('logoUrl');
    const logoFileInput = document.getElementById('logoFile');
    const logoPreview = document.getElementById('logoPreview');
    const logoPreviewContainer = document.getElementById('logoPreviewContainer');

    if (logoUrlInput) {
        logoUrlInput.addEventListener('input', function() {
            const val = this.value.trim();
            if (val) {
                logoPreview.src = val;
                logoPreviewContainer.style.display = 'block';
                appState.logoDataUrl = null; // URL takes precedence
            } else {
                logoPreviewContainer.style.display = 'none';
            }
        });
    }

    if (logoFileInput) {
        logoFileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                showNotification('Logo file must be under 2 MB', 'error');
                this.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                appState.logoDataUrl = e.target.result;
                logoPreview.src = e.target.result;
                logoPreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        });
    }
}

// ── Cover image upload (URL + file) ──────────────────────────────────────────
function switchCoverTab(tab) {
    const urlTab = document.getElementById('coverUrlTab');
    const fileTab = document.getElementById('coverFileTab');
    const urlBtn = document.getElementById('coverUrlTabBtn');
    const fileBtn = document.getElementById('coverFileTabBtn');
    if (!urlTab) return;
    if (tab === 'url') {
        urlTab.style.display = 'block';
        fileTab.style.display = 'none';
        urlBtn.classList.add('active');
        fileBtn.classList.remove('active');
    } else {
        urlTab.style.display = 'none';
        fileTab.style.display = 'block';
        fileBtn.classList.add('active');
        urlBtn.classList.remove('active');
    }
}

function setupCoverUpload() {
    const coverUrlInput = document.getElementById('coverImageUrl');
    const coverFileInput = document.getElementById('coverFile');
    const coverPreview = document.getElementById('coverPreview');
    const coverPreviewContainer = document.getElementById('coverPreviewContainer');

    if (coverUrlInput) {
        coverUrlInput.addEventListener('input', function() {
            const val = this.value.trim();
            if (val) {
                coverPreview.src = val;
                coverPreviewContainer.style.display = 'block';
                appState.coverDataUrl = null;
            } else {
                coverPreviewContainer.style.display = 'none';
            }
        });
    }

    if (coverFileInput) {
        coverFileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                showNotification('Cover image must be under 5 MB', 'error');
                this.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                appState.coverDataUrl = e.target.result;
                coverPreview.src = e.target.result;
                coverPreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        });
    }
}

// Populate year dropdown
function populateYearDropdown() {
    const yearSelect = document.getElementById('yearEstablished');
    const currentYear = new Date().getFullYear();
    
    // Clear existing options
    yearSelect.innerHTML = '<option value="">Select Year</option>';
    
    // Add years from 1980 to current year
    for (let year = currentYear; year >= 1980; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Next and Previous buttons
    document.querySelectorAll('.btn-next').forEach(button => {
        button.addEventListener('click', function() {
            const nextStep = parseInt(this.dataset.next);
            if (validateCurrentStep()) {
                saveStepData();
                showStep(nextStep);
            }
        });
    });
    
    document.querySelectorAll('.btn-prev').forEach(button => {
        button.addEventListener('click', function() {
            const prevStep = parseInt(this.dataset.prev);
            saveStepData();
            showStep(prevStep);
        });
    });
    
    // Progress steps click
    document.querySelectorAll('.step').forEach(step => {
        step.addEventListener('click', function() {
            const stepNum = parseInt(this.dataset.step);
            if (stepNum <= appState.currentStep) {
                saveStepData();
                showStep(stepNum);
            }
        });
    });
    
    // Legal registration warning
    document.getElementById('isLegallyRegistered').addEventListener('change', function() {
        document.getElementById('legalWarning').style.display = this.checked ? 'none' : 'flex';
    });
    
    // Add city button
    document.getElementById('addCityBtn').addEventListener('click', addNewCity);
    
    // Slider value displays
    document.getElementById('advancePercentage').addEventListener('input', function() {
        document.getElementById('advanceValue').textContent = this.value + '%';
    });
    
    document.getElementById('reliabilityScore').addEventListener('input', function() {
        document.getElementById('reliabilityValue').textContent = this.value;
    });
    
    // Form submission
    form.addEventListener('submit', handleFormSubmit);
    
    // Input validation and formatting
    setupInputFormatting();
    
    // Auto-save on input change
    setupAutoSave();
}

// Setup input formatting - FIXED VERSION
function setupInputFormatting() {
    // NTN formatting - FIXED
    document.getElementById('ntnNumber').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 7) {
            value = value.substring(0, 7) + '-' + value.substring(7, 8);
        }
        e.target.value = value;
    });
    
    // Phone number formatting - FIXED (simplified)
    document.getElementById('phoneNumber').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        // Allow user to type freely
        if (value.length > 0) {
            // Format as +92-XXX-XXXXXXX
            let formatted = '+92-';
            if (value.length > 2) {
                formatted += value.substring(0, 3);
                if (value.length > 3) {
                    formatted += '-' + value.substring(3, 10);
                }
            } else {
                formatted += value;
            }
            e.target.value = formatted;
        }
    });
    
    // Website URL formatting
    document.getElementById('website').addEventListener('blur', function(e) {
        let value = e.target.value.trim();
        if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
            e.target.value = 'https://' + value;
        }
    });
    
    // Cost input formatting - add thousand separators for better UX
    document.querySelectorAll('.cost-input').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value) {
                const num = parseInt(this.value.replace(/\D/g, ''));
                if (!isNaN(num)) {
                    this.value = num.toLocaleString('en-US');
                }
            }
        });
        
        input.addEventListener('focus', function() {
            this.value = this.value.replace(/\D/g, '');
        });
    });
}

// Setup auto-save
function setupAutoSave() {
    // Auto-save form data to localStorage
    form.addEventListener('input', debounce(function() {
        saveStepData();
    }, 1000));
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Save current step data
function saveStepData() {
    const stepData = {};
    const currentStep = document.querySelector('.form-step.active');
    
    // Collect all form data from current step
    const inputs = currentStep.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            stepData[input.name] = input.checked;
        } else if (input.classList.contains('cost-input')) {
            // Remove commas from cost inputs before saving
            stepData[input.name] = input.value.replace(/,/g, '');
        } else {
            stepData[input.name] = input.value;
        }
    });
    
    // Save to localStorage
    localStorage.setItem(`step${appState.currentStep}`, JSON.stringify(stepData));
}

// Load saved step data
function loadStepData(step) {
    const savedData = localStorage.getItem(`step${step}`);
    if (savedData) {
        return JSON.parse(savedData);
    }
    return null;
}

// Setup package tabs
function setupPackageTabs() {
    const tabs = document.querySelectorAll('.package-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const packageType = this.dataset.package;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding content
            document.querySelectorAll('.package-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(packageType + 'Package').classList.add('active');
        });
    });
}

// Setup materials tabs
function setupMaterialsTabs() {
    const tabs = document.querySelectorAll('.materials-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Setup timeline tabs
function setupTimelineTabs() {
    const tabs = document.querySelectorAll('.timeline-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const size = this.dataset.size;
            
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.timeline-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('timeline' + size).classList.add('active');
        });
    });
}

// Show specific step
function showStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > appState.totalSteps) return;
    
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show current step
    const stepElement = document.getElementById('step' + stepNumber);
    stepElement.classList.add('active');
    
    // Update progress
    appState.currentStep = stepNumber;
    updateProgressBar();
    
    // Load saved data for this step
    const savedData = loadStepData(stepNumber);
    if (savedData) {
        Object.keys(savedData).forEach(key => {
            const input = stepElement.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = savedData[key];
                } else if (input.classList.contains('cost-input')) {
                    // Format cost inputs with commas
                    const numValue = savedData[key];
                    if (numValue && !isNaN(numValue)) {
                        input.value = parseInt(numValue).toLocaleString('en-US');
                    }
                } else {
                    input.value = savedData[key];
                }
            }
        });
    }
    
    // Scroll to top of form
    stepElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Update any dynamic displays
    updateDynamicDisplays();
}

// Update dynamic displays
function updateDynamicDisplays() {
    // Update slider displays
    if (document.getElementById('advancePercentage')) {
        document.getElementById('advanceValue').textContent = 
            document.getElementById('advancePercentage').value + '%';
    }
    
    if (document.getElementById('reliabilityScore')) {
        document.getElementById('reliabilityValue').textContent = 
            document.getElementById('reliabilityScore').value;
    }
}

// Update progress bar and step indicators
function updateProgressBar() {
    const progressPercentage = ((appState.currentStep - 1) / (appState.totalSteps - 1)) * 100;
    progressBar.style.setProperty('--progress-width', progressPercentage + '%');
    
    // Update step indicators
    document.querySelectorAll('.step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        
        if (stepNum === appState.currentStep) {
            step.classList.add('active');
        } else if (stepNum < appState.currentStep) {
            step.classList.add('completed');
        }
    });
}

// Initialize operational areas
function initializeOperationalAreas() {
    addNewCity(); // Start with one city
}

// Add new city section
function addNewCity() {
    const container = document.getElementById('operationalAreasContainer');
    const cityId = 'city-' + Date.now();
    const cityNumber = document.querySelectorAll('.operational-area').length + 1;
    
    const cityHTML = `
        <div class="operational-area" data-city-id="${cityId}">
            <div class="city-header">
                <h3>City ${cityNumber}</h3>
                <button type="button" class="remove-btn" onclick="removeCity('${cityId}')">
                    <i class="fas fa-trash"></i> Remove City
                </button>
            </div>
            
            <div class="form-group">
                <label for="${cityId}-city">Select City</label>
                <select id="${cityId}-city" class="city-select" onchange="updateCitySocieties('${cityId}', this.value)">
                    <option value="">Select City</option>
                    ${Object.keys(appState.cities).map(city => 
                        `<option value="${city}">${city}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="form-group" id="${cityId}-otherCityContainer" style="display: none;">
                <label for="${cityId}-otherCity">Enter City Name</label>
                <input type="text" id="${cityId}-otherCity" placeholder="Enter city name">
            </div>
            
            <div class="societies-container" id="${cityId}-societies">
                <!-- Societies will be added here -->
            </div>
            
            <button type="button" class="btn-add" onclick="addSociety('${cityId}')">
                <i class="fas fa-plus-circle"></i> Add Society/Area
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', cityHTML);
    
    // Add initial society
    addSociety(cityId);
}

// Update societies based on selected city
function updateCitySocieties(cityId, selectedCity) {
    const otherCityContainer = document.getElementById(`${cityId}-otherCityContainer`);
    
    if (selectedCity === 'Other') {
        otherCityContainer.style.display = 'block';
    } else {
        otherCityContainer.style.display = 'none';
    }
    
    // Update societies dropdown for existing societies
    const societySelects = document.querySelectorAll(`#${cityId}-societies select.society-select`);
    societySelects.forEach(select => {
        updateSocietyOptions(select, selectedCity);
    });
}

// Update society options
function updateSocietyOptions(selectElement, city) {
    const societies = appState.cities[city]?.societies || [];
    const currentValue = selectElement.value;
    
    // Clear existing options
    selectElement.innerHTML = '<option value="">Select Society/Area</option>';
    
    // Add societies for selected city
    societies.forEach(society => {
        const option = document.createElement('option');
        option.value = society;
        option.textContent = society;
        selectElement.appendChild(option);
    });
    
    // Add "Other" option
    const otherOption = document.createElement('option');
    otherOption.value = 'Other';
    otherOption.textContent = 'Other (Please specify)';
    selectElement.appendChild(otherOption);
    
    // Restore previous value if it exists in new list
    if (currentValue && societies.includes(currentValue)) {
        selectElement.value = currentValue;
    }
}

// Add society to a city
function addSociety(cityId) {
    const societiesContainer = document.getElementById(`${cityId}-societies`);
    const societyId = 'society-' + Date.now();
    const selectedCity = document.getElementById(`${cityId}-city`).value || 'Karachi';
    
    const societyHTML = `
        <div class="society-item" data-society-id="${societyId}">
            <div class="form-group">
                <label for="${societyId}-name">Select Society/Area</label>
                <select id="${societyId}-name" class="society-select" onchange="toggleSocietyOther('${societyId}', this.value)">
                    <option value="">Select Society/Area</option>
                    ${(appState.cities[selectedCity]?.societies || []).map(society => 
                        `<option value="${society}">${society}</option>`
                    ).join('')}
                    <option value="Other">Other (Please specify)</option>
                </select>
            </div>
            
            <div class="form-group" id="${societyId}-otherSocietyContainer" style="display: none;">
                <label for="${societyId}-otherSociety">Enter Society Name</label>
                <input type="text" id="${societyId}-otherSociety" placeholder="Enter society/area name">
            </div>
            
            <div class="phases-container" id="${societyId}-phases">
                <!-- Phases will be added here -->
            </div>
            
            <button type="button" class="btn-add" onclick="addPhase('${societyId}')">
                <i class="fas fa-plus-circle"></i> Add Phase/Block
            </button>
            
            <button type="button" class="remove-btn" onclick="removeSociety('${societyId}')" style="margin-top: 10px;">
                <i class="fas fa-trash"></i> Remove Society
            </button>
        </div>
    `;
    
    societiesContainer.insertAdjacentHTML('beforeend', societyHTML);
    
    // Add initial phase
    addPhase(societyId);
}

// Toggle other society input
function toggleSocietyOther(societyId, value) {
    const otherContainer = document.getElementById(`${societyId}-otherSocietyContainer`);
    otherContainer.style.display = value === 'Other' ? 'block' : 'none';
}

// Add phase to a society
function addPhase(societyId) {
    const phasesContainer = document.getElementById(`${societyId}-phases`);
    const phaseId = 'phase-' + Date.now();
    const cityId = societyId.split('-')[1];
    const selectedCity = document.getElementById(`city-${cityId}-city`)?.value || 'Karachi';
    const phases = appState.cities[selectedCity]?.phases || appState.cities['Karachi'].phases;
    
    const phaseHTML = `
        <div class="phase-item" data-phase-id="${phaseId}">
            <div class="form-group">
                <label for="${phaseId}-name">Select Phase/Block</label>
                <select id="${phaseId}-name" class="phase-select" onchange="togglePhaseOther('${phaseId}', this.value)">
                    <option value="">Select Phase/Block</option>
                    ${phases.map(phase => 
                        `<option value="${phase}">${phase}</option>`
                    ).join('')}
                    <option value="Other">Other (Please specify)</option>
                </select>
            </div>
            
            <div class="form-group" id="${phaseId}-otherPhaseContainer" style="display: none;">
                <label for="${phaseId}-otherPhase">Enter Phase Name</label>
                <input type="text" id="${phaseId}-otherPhase" placeholder="Enter phase/block name">
            </div>
            
            <div class="phase-rates">
                <div class="form-group">
                    <label for="${phaseId}-standard">Standard Rate (PKR/sq ft)</label>
                    <input type="number" id="${phaseId}-standard" placeholder="0" min="0" step="10" value="1800">
                </div>
                
                <div class="form-group">
                    <label for="${phaseId}-premium">Premium Rate (PKR/sq ft)</label>
                    <input type="number" id="${phaseId}-premium" placeholder="0" min="0" step="10" value="2200">
                </div>
                
                <div class="form-group">
                    <label for="${phaseId}-executive">Executive Rate (PKR/sq ft)</label>
                    <input type="number" id="${phaseId}-executive" placeholder="0" min="0" step="10" value="2800">
                </div>
            </div>
            
            <button type="button" class="remove-btn" onclick="removePhase('${phaseId}')">
                <i class="fas fa-trash"></i> Remove Phase
            </button>
        </div>
    `;
    
    phasesContainer.insertAdjacentHTML('beforeend', phaseHTML);
}

// Toggle other phase input
function togglePhaseOther(phaseId, value) {
    const otherContainer = document.getElementById(`${phaseId}-otherPhaseContainer`);
    otherContainer.style.display = value === 'Other' ? 'block' : 'none';
}

// Remove city
function removeCity(cityId) {
    const cityElement = document.querySelector(`[data-city-id="${cityId}"]`);
    if (cityElement && document.querySelectorAll('.operational-area').length > 1) {
        cityElement.remove();
        updateCityNumbers();
    } else {
        showNotification('At least one city is required', 'error');
    }
}

// Remove society
function removeSociety(societyId) {
    const societyElement = document.querySelector(`[data-society-id="${societyId}"]`);
    if (societyElement) {
        societyElement.remove();
    }
}

// Remove phase
function removePhase(phaseId) {
    const phaseElement = document.querySelector(`[data-phase-id="${phaseId}"]`);
    if (phaseElement) {
        phaseElement.remove();
    }
}

// Update city numbers
function updateCityNumbers() {
    const cities = document.querySelectorAll('.operational-area');
    cities.forEach((city, index) => {
        city.querySelector('h3').textContent = `City ${index + 1}`;
    });
}

// Validate current step - FIXED validation
function validateCurrentStep() {
    const currentStep = document.querySelector('.form-step.active');
    const stepNumber = appState.currentStep;
    
    console.log(`Validating step ${stepNumber}`);
    
    // Get all required inputs in current step
    const requiredInputs = currentStep.querySelectorAll('[required]');
    
    for (const input of requiredInputs) {
        if (input.type === 'text' || input.type === 'email' || input.type === 'tel' || input.type === 'url' || input.type === 'number') {
            if (!input.value.trim()) {
                const label = input.previousElementSibling?.textContent || 'this field';
                showNotification(`Please fill in ${label}`, 'error');
                input.classList.add('validation-error');
                input.focus();
                return false;
            }
            input.classList.remove('validation-error');
        }
        
        if (input.type === 'checkbox' && !input.checked) {
            const label = input.parentElement?.querySelector('span')?.textContent || 'this checkbox';
            showNotification(`Please check ${label}`, 'error');
            return false;
        }
        
        if (input.tagName === 'SELECT' && !input.value) {
            const label = input.previousElementSibling?.textContent || 'this selection';
            showNotification(`Please select ${label}`, 'error');
            input.classList.add('validation-error');
            return false;
        }
        input.classList.remove('validation-error');
    }
    
    // Validate specific fields based on step
    switch(stepNumber) {
        case 1:
            const companyName = document.getElementById('companyName');
            if (!companyName.value.trim()) {
                showNotification('Company name is required', 'error');
                companyName.classList.add('validation-error');
                companyName.focus();
                return false;
            }
            companyName.classList.remove('validation-error');

            const hqCitySelect = document.getElementById('hqCity');
            if (!hqCitySelect || !hqCitySelect.value) {
                showNotification('Please select your headquarters city', 'error');
                if (hqCitySelect) hqCitySelect.classList.add('validation-error');
                return false;
            }
            if (hqCitySelect.value === 'Other') {
                const hqCityOther = document.getElementById('hqCityOther');
                if (!hqCityOther || !hqCityOther.value.trim()) {
                    showNotification('Please enter your city name', 'error');
                    if (hqCityOther) hqCityOther.classList.add('validation-error');
                    return false;
                }
                if (hqCityOther) hqCityOther.classList.remove('validation-error');
            }
            if (hqCitySelect) hqCitySelect.classList.remove('validation-error');
            break;
            
        case 2:
            // NTN validation is optional, only validate format if filled
            const ntnInput = document.getElementById('ntnNumber');
            if (ntnInput.value && !/^\d{7}-\d$/.test(ntnInput.value)) {
                showNotification('NTN Number must be in format 1234567-8', 'error');
                ntnInput.classList.add('validation-error');
                ntnInput.focus();
                return false;
            }
            ntnInput.classList.remove('validation-error');
            break;
            
        case 3:
            const phoneInput = document.getElementById('phoneNumber');
            if (!phoneInput.value.trim()) {
                showNotification('Phone number is required', 'error');
                phoneInput.classList.add('validation-error');
                phoneInput.focus();
                return false;
            }
            
            // More flexible phone validation
            if (!/^\+92-\d{3}-\d{7}$/.test(phoneInput.value)) {
                showNotification('Phone number must be in format +92-300-1234567', 'error');
                phoneInput.classList.add('validation-error');
                phoneInput.focus();
                return false;
            }
            phoneInput.classList.remove('validation-error');
            
            const emailInput = document.getElementById('email');
            if (!emailInput.value.trim()) {
                showNotification('Email address is required', 'error');
                emailInput.classList.add('validation-error');
                emailInput.focus();
                return false;
            }
            
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(emailInput.value)) {
                showNotification('Please enter a valid email address', 'error');
                emailInput.classList.add('validation-error');
                emailInput.focus();
                return false;
            }
            emailInput.classList.remove('validation-error');
            
            // Website is optional, validate if filled
            const websiteInput = document.getElementById('website');
            if (websiteInput.value.trim()) {
                try {
                    new URL(websiteInput.value);
                } catch (_) {
                    showNotification('Please enter a valid website URL (including http:// or https://)', 'error');
                    websiteInput.classList.add('validation-error');
                    websiteInput.focus();
                    return false;
                }
            }
            websiteInput.classList.remove('validation-error');
            break;
            
        case 4:
            // Validate at least one city is selected
            const citySelects = document.querySelectorAll('.city-select');
            let hasCity = false;
            for (const select of citySelects) {
                if (select.value && select.value !== '') {
                    hasCity = true;
                    select.classList.remove('validation-error');
                    break;
                } else {
                    select.classList.add('validation-error');
                }
            }
            
            if (!hasCity) {
                showNotification('Please select at least one city where you operate', 'error');
                return false;
            }
            
            // Validate societies for selected cities
            let hasSociety = false;
            document.querySelectorAll('.society-item').forEach(society => {
                const societySelect = society.querySelector('.society-select');
                if (societySelect && societySelect.value) {
                    hasSociety = true;
                    societySelect.classList.remove('validation-error');
                } else {
                    societySelect?.classList.add('validation-error');
                }
            });
            
            if (!hasSociety) {
                showNotification('Please add at least one society/area for the selected city', 'error');
                return false;
            }
            break;
            
        case 5:
            // Validate at least one plot size is selected
            const plotSizeCheckboxes = document.querySelectorAll('input[name="plotSizes"]:checked');
            if (plotSizeCheckboxes.length === 0) {
                showNotification('Please select at least one plot size', 'error');
                return false;
            }
            
            // Validate max floors is selected
            const maxFloorsSelect = document.getElementById('maxFloors');
            if (!maxFloorsSelect.value) {
                showNotification('Please select maximum floors supported', 'error');
                maxFloorsSelect.classList.add('validation-error');
                return false;
            }
            maxFloorsSelect.classList.remove('validation-error');
            
            // Validate at least one house type is selected
            const houseTypeCheckboxes = document.querySelectorAll('input[name="houseTypes"]:checked');
            if (houseTypeCheckboxes.length === 0) {
                showNotification('Please select at least one house type', 'error');
                return false;
            }
            break;
            
        case 6:
            // Validate at least one construction service is selected
            const constructionServices = document.querySelectorAll('input[name="constructionServices"]:checked');
            if (constructionServices.length === 0) {
                showNotification('Please select at least one construction service', 'error');
                return false;
            }
            break;
    }
    
    return true;
}

// Helper function to validate URL
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Helper to get checked values
function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
               .map(input => input.value);
}

// Show notification
function showNotification(message, type = 'success') {
    notificationText.textContent = message;
    notification.className = 'notification';
    notification.classList.add(type, 'show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateCurrentStep()) {
        return;
    }
    
    // Check terms acceptance
    if (!document.getElementById('acceptTerms').checked) {
        showNotification('Please accept the Terms & Conditions', 'error');
        return;
    }
    
    // Build JSON data
    const formData = buildFormData();
    
    // Show loading state
    const submitBtn = e.target.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;
    
    try {
        // Simulate API call
        await simulateSubmission(formData);
        
        showNotification('Registration submitted successfully! Your company ID will be generated by admin.', 'success');
        
        // Clear localStorage
        clearLocalStorage();
        
        // Reset form after successful submission
        setTimeout(() => {
            form.reset();
            showStep(1);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }, 3000);
        
    } catch (error) {
        showNotification('Submission failed. Please try again.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Clear localStorage
function clearLocalStorage() {
    for (let i = 1; i <= 16; i++) {
        localStorage.removeItem(`step${i}`);
    }
}

// Build form data structure
function buildFormData() {
    // Collect operational areas data
    const operationalAreas = [];
    document.querySelectorAll('.operational-area').forEach(cityElement => {
        const citySelect = cityElement.querySelector('.city-select');
        let cityName = citySelect.value;
        
        if (cityName === 'Other') {
            cityName = cityElement.querySelector('input[type="text"]').value;
        }
        
        if (!cityName) return;
        
        const cityData = {
            city: cityName,
            societies: []
        };
        
        cityElement.querySelectorAll('.society-item').forEach(societyElement => {
            const societySelect = societyElement.querySelector('.society-select');
            let societyName = societySelect.value;
            
            if (societyName === 'Other') {
                societyName = societyElement.querySelector('input[type="text"]').value;
            }
            
            if (!societyName) return;
            
            const societyData = {
                societyName: societyName,
                phases: []
            };
            
            societyElement.querySelectorAll('.phase-item').forEach(phaseElement => {
                const phaseSelect = phaseElement.querySelector('.phase-select');
                let phaseName = phaseSelect.value;
                
                if (phaseName === 'Other') {
                    phaseName = phaseElement.querySelector('input[type="text"]').value;
                }
                
                const standardRate = phaseElement.querySelector('input[id$="-standard"]').value;
                const premiumRate = phaseElement.querySelector('input[id$="-premium"]').value;
                const executiveRate = phaseElement.querySelector('input[id$="-executive"]').value;
                
                if (phaseName) {
                    societyData.phases.push({
                        phaseName: phaseName,
                        rates: {
                            standard: parseInt(standardRate) || 0,
                            premium: parseInt(premiumRate) || 0,
                            executive: parseInt(executiveRate) || 0
                        }
                    });
                }
            });
            
            if (societyData.phases.length > 0) {
                cityData.societies.push(societyData);
            }
        });
        
        if (cityData.societies.length > 0) {
            operationalAreas.push(cityData);
        }
    });
    
    // Collect checkbox groups
    function getCheckedValues(name) {
        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
                   .map(input => input.value);
    }
    
    // Build complete data structure
    const formData = {
        // ── Step 1 ──────────────────────────────────────────────────────────
        companyName: document.getElementById('companyName').value.trim(),
        city: (function() {
            const sel = document.getElementById('hqCity');
            if (!sel) return '';
            if (sel.value === 'Other') {
                return (document.getElementById('hqCityOther')?.value || '').trim();
            }
            return sel.value;
        })(),
        description: (document.getElementById('companyDescription')?.value || '').trim() || null,
        logo_url: (function() {
            if (appState.logoDataUrl) return appState.logoDataUrl;
            return (document.getElementById('logoUrl')?.value || '').trim() || null;
        })(),
        cover_image_url: (function() {
            if (appState.coverDataUrl) return appState.coverDataUrl;
            return (document.getElementById('coverImageUrl')?.value || '').trim() || null;
        })(),
        // ── Step 2 ──────────────────────────────────────────────────────────
        legalRegistration: {
            isLegallyRegistered: document.getElementById('isLegallyRegistered').checked,
            secpRegistered: document.getElementById('secpRegistered').checked,
            ntnNumber: document.getElementById('ntnNumber').value,
            yearEstablished: parseInt(document.getElementById('yearEstablished').value) || null
        },
        contact: {
            phone: document.getElementById('phoneNumber').value,
            email: document.getElementById('email').value,
            website: document.getElementById('website').value || ''
        },
        operationalAreas: operationalAreas,
        constructionCapability: {
            plotSizes: getCheckedValues('plotSizes'),
            maxFloors: parseInt(document.getElementById('maxFloors').value) || null,
            basementSupported: document.getElementById('basementSupported').checked,
            houseTypes: getCheckedValues('houseTypes')
        },
        servicesOffered: {
            constructionServices: getCheckedValues('constructionServices'),
            designServices: getCheckedValues('designServices'),
            approvalSupport: getCheckedValues('approvalSupport'),
            extraServices: getCheckedValues('extraServices')
        },
        packageScope: {
            standard: {
                designIncluded: document.querySelector('input[name="standardDesignIncluded"]')?.checked || false,
                fixturesQuality: document.getElementById('standardFixturesQuality')?.value || '',
                ceilingType: document.getElementById('standardCeilingType')?.value || '',
                kitchenType: document.getElementById('standardKitchenType')?.value || '',
                bathroomFittings: document.getElementById('standardBathroomFittings')?.value || ''
            },
            premium: {
                designIncluded: document.querySelector('input[name="premiumDesignIncluded"]')?.checked || false,
                fixturesQuality: document.getElementById('premiumFixturesQuality')?.value || '',
                ceilingType: document.getElementById('premiumCeilingType')?.value || '',
                kitchenType: document.getElementById('premiumKitchenType')?.value || '',
                bathroomFittings: document.getElementById('premiumBathroomFittings')?.value || ''
            },
            executive: {
                designIncluded: document.querySelector('input[name="executiveDesignIncluded"]')?.checked || false,
                fixturesQuality: document.getElementById('executiveFixturesQuality')?.value || '',
                ceilingType: document.getElementById('executiveCeilingType')?.value || '',
                kitchenType: document.getElementById('executiveKitchenType')?.value || '',
                bathroomFittings: document.getElementById('executiveBathroomFittings')?.value || ''
            }
        },
        materialsUsed: {
            standard: {
                cementBrand: document.querySelector('select[name="standardCementBrand"]')?.value || '',
                cementBrandOther: document.querySelector('input[name="standardCementBrandOther"]')?.value || '',
                steelGrade: document.querySelector('select[name="standardSteelGrade"]')?.value || '',
                steelGradeOther: document.querySelector('input[name="standardSteelGradeOther"]')?.value || '',
                bricksType: document.querySelector('select[name="standardBricksType"]')?.value || '',
                bricksTypeOther: document.querySelector('input[name="standardBricksTypeOther"]')?.value || '',
                wiringBrand: document.querySelector('select[name="standardWiringBrand"]')?.value || '',
                wiringBrandOther: document.querySelector('input[name="standardWiringBrandOther"]')?.value || '',
                plumbingBrand: document.querySelector('select[name="standardPlumbingBrand"]')?.value || '',
                plumbingBrandOther: document.querySelector('input[name="standardPlumbingBrandOther"]')?.value || '',
                paintBrand: document.querySelector('select[name="standardPaintBrand"]')?.value || '',
                paintBrandOther: document.querySelector('input[name="standardPaintBrandOther"]')?.value || ''
            },
            premium: {
                cementBrand: document.querySelector('select[name="premiumCementBrand"]')?.value || '',
                cementBrandOther: document.querySelector('input[name="premiumCementBrandOther"]')?.value || '',
                steelGrade: document.querySelector('select[name="premiumSteelGrade"]')?.value || '',
                steelGradeOther: document.querySelector('input[name="premiumSteelGradeOther"]')?.value || '',
                bricksType: document.querySelector('select[name="premiumBricksType"]')?.value || '',
                bricksTypeOther: document.querySelector('input[name="premiumBricksTypeOther"]')?.value || '',
                wiringBrand: document.querySelector('select[name="premiumWiringBrand"]')?.value || '',
                wiringBrandOther: document.querySelector('input[name="premiumWiringBrandOther"]')?.value || '',
                plumbingBrand: document.querySelector('select[name="premiumPlumbingBrand"]')?.value || '',
                plumbingBrandOther: document.querySelector('input[name="premiumPlumbingBrandOther"]')?.value || '',
                paintBrand: document.querySelector('select[name="premiumPaintBrand"]')?.value || '',
                paintBrandOther: document.querySelector('input[name="premiumPaintBrandOther"]')?.value || ''
            },
            executive: {
                cementBrand: document.querySelector('select[name="executiveCementBrand"]')?.value || '',
                cementBrandOther: document.querySelector('input[name="executiveCementBrandOther"]')?.value || '',
                steelGrade: document.querySelector('select[name="executiveSteelGrade"]')?.value || '',
                steelGradeOther: document.querySelector('input[name="executiveSteelGradeOther"]')?.value || '',
                bricksType: document.querySelector('select[name="executiveBricksType"]')?.value || '',
                bricksTypeOther: document.querySelector('input[name="executiveBricksTypeOther"]')?.value || '',
                wiringBrand: document.querySelector('select[name="executiveWiringBrand"]')?.value || '',
                wiringBrandOther: document.querySelector('input[name="executiveWiringBrandOther"]')?.value || '',
                plumbingBrand: document.querySelector('select[name="executivePlumbingBrand"]')?.value || '',
                plumbingBrandOther: document.querySelector('input[name="executivePlumbingBrandOther"]')?.value || '',
                paintBrand: document.querySelector('select[name="executivePaintBrand"]')?.value || '',
                paintBrandOther: document.querySelector('input[name="executivePaintBrandOther"]')?.value || ''
            }
        },
        estimatedCostRange: {
            currency: "PKR",
            "3Marla": {
                standard: {
                    min: buildCostRangeValue(document.querySelector('input[name="standard3MarlaMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="standard3MarlaMax"]')?.value)
                },
                premium: {
                    min: buildCostRangeValue(document.querySelector('input[name="premium3MarlaMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="premium3MarlaMax"]')?.value)
                },
                executive: {
                    min: buildCostRangeValue(document.querySelector('input[name="executive3MarlaMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="executive3MarlaMax"]')?.value)
                }
            },
            "5Marla": {
                standard: {
                    min: buildCostRangeValue(document.querySelector('input[name="standard5MarlaMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="standard5MarlaMax"]')?.value)
                },
                premium: {
                    min: buildCostRangeValue(document.querySelector('input[name="premium5MarlaMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="premium5MarlaMax"]')?.value)
                },
                executive: {
                    min: buildCostRangeValue(document.querySelector('input[name="executive5MarlaMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="executive5MarlaMax"]')?.value)
                }
            },
            "10Marla": {
                standard: {
                    min: buildCostRangeValue(document.querySelector('input[name="standard10MarlaMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="standard10MarlaMax"]')?.value)
                },
                premium: {
                    min: buildCostRangeValue(document.querySelector('input[name="premium10MarlaMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="premium10MarlaMax"]')?.value)
                },
                executive: {
                    min: buildCostRangeValue(document.querySelector('input[name="executive10MarlaMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="executive10MarlaMax"]')?.value)
                }
            },
            "1Kanal": {
                standard: {
                    min: buildCostRangeValue(document.querySelector('input[name="standard1KanalMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="standard1KanalMax"]')?.value)
                },
                premium: {
                    min: buildCostRangeValue(document.querySelector('input[name="premium1KanalMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="premium1KanalMax"]')?.value)
                },
                executive: {
                    min: buildCostRangeValue(document.querySelector('input[name="executive1KanalMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="executive1KanalMax"]')?.value)
                }
            },
            "2Kanal": {
                standard: {
                    min: buildCostRangeValue(document.querySelector('input[name="standard2KanalMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="standard2KanalMax"]')?.value)
                },
                premium: {
                    min: buildCostRangeValue(document.querySelector('input[name="premium2KanalMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="premium2KanalMax"]')?.value)
                },
                executive: {
                    min: buildCostRangeValue(document.querySelector('input[name="executive2KanalMin"]')?.value),
                    max: buildCostRangeValue(document.querySelector('input[name="executive2KanalMax"]')?.value)
                }
            }
        },
        paymentTerms: {
            advancePercentage: parseInt(document.getElementById('advancePercentage').value),
            installmentType: document.getElementById('installmentType').value,
            priceType: document.getElementById('priceType').value,
            variationClauseExists: document.getElementById('variationClauseExists').checked
        },
        timelineEstimates: {
            "3Marla": {
                singleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="single3MarlaMin"]').value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="single3MarlaTypical"]').value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="single3MarlaMax"]').value) || 0
                },
                doubleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="double3MarlaMin"]').value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="double3MarlaTypical"]').value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="double3MarlaMax"]').value) || 0
                }
            },
            "5Marla": {
                singleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="single5MarlaMin"]')?.value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="single5MarlaTypical"]')?.value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="single5MarlaMax"]')?.value) || 0
                },
                doubleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="double5MarlaMin"]')?.value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="double5MarlaTypical"]')?.value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="double5MarlaMax"]')?.value) || 0
                }
            },
            "10Marla": {
                singleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="single10MarlaMin"]')?.value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="single10MarlaTypical"]')?.value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="single10MarlaMax"]')?.value) || 0
                },
                doubleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="double10MarlaMin"]')?.value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="double10MarlaTypical"]')?.value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="double10MarlaMax"]')?.value) || 0
                }
            },
            "1Kanal": {
                singleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="single1KanalMin"]')?.value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="single1KanalTypical"]')?.value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="single1KanalMax"]')?.value) || 0
                },
                doubleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="double1KanalMin"]')?.value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="double1KanalTypical"]')?.value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="double1KanalMax"]')?.value) || 0
                }
            },
            "2Kanal": {
                singleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="single2KanalMin"]')?.value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="single2KanalTypical"]')?.value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="single2KanalMax"]')?.value) || 0
                },
                doubleStorey: {
                    minTime: parseFloat(document.querySelector('input[name="double2KanalMin"]')?.value) || 0,
                    typicalTime: parseFloat(document.querySelector('input[name="double2KanalTypical"]')?.value) || 0,
                    maxTime: parseFloat(document.querySelector('input[name="double2KanalMax"]')?.value) || 0
                }
            }
        },
        experience: {
            totalProjectsCompleted: document.getElementById('totalProjects').value || '',
            housesCompleted: document.getElementById('housesCompleted').value || '',
            ongoingProjects: document.getElementById('ongoingProjects').value || '',
            specializations: getCheckedValues('specializations')
        },
        qualityControl: {
            siteEngineerAssigned: document.getElementById('siteEngineerAssigned').checked,
            materialVerification: document.getElementById('materialVerification').checked,
            weeklyReporting: document.getElementById('weeklyReporting').checked
        },
        afterHandoverSupport: {
            defectLiabilityPeriod: parseInt(document.getElementById('defectLiabilityPeriod').value) || 0,
            maintenanceSupport: document.getElementById('maintenanceSupport').checked,
            supportResponseTime: parseInt(document.getElementById('supportResponseTime').value) || 0
        },
        legalAndContract: {
            writtenContractProvided: document.getElementById('writtenContractProvided').checked,
            boqProvided: document.getElementById('boqProvided').checked,
            penaltyForDelay: document.getElementById('penaltyForDelay').checked,
            warrantyDuration: parseInt(document.getElementById('warrantyDuration').value) || 0
        },
        idealCustomerProfile: {
            bestFor: getCheckedValues('bestFor'),
            notIdealFor: getCheckedValues('notIdealFor')
        },
        submissionDate: new Date().toISOString(),
        status: "pending"
    };
    
    // Log the data structure (for debugging)
    console.log('Form Data Structure:', formData);
    
    // Export data as JSON
    exportDataAsJSON(formData);
    
    return formData;
}

// Export data as JSON file
function exportDataAsJSON(data) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `construction-company-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Simulate submission
function simulateSubmission(data) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate 90% success rate
            const success = Math.random() > 0.1;
            
            if (success) {
                // Save to localStorage for demo
                const submissions = JSON.parse(localStorage.getItem('constructionSubmissions') || '[]');
                submissions.push({
                    id: 'SUB-' + Date.now(),
                    ...data,
                    companyId: 'CC-' + String(submissions.length + 1).padStart(4, '0')
                });
                localStorage.setItem('constructionSubmissions', JSON.stringify(submissions));
                
                resolve({ success: true, message: 'Data saved successfully' });
            } else {
                reject(new Error('Network error occurred'));
            }
        }, 1500);
    });
}