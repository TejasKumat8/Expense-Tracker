// API Configuration
const EXCHANGE_API_KEY = '3e2fc77238fbf35527764170'; // Replace with your API key from exchangerate-api.com
const EXCHANGE_API_BASE = 'https://v6.exchangerate-api.com/v6';

// State management
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let preferredCurrency = localStorage.getItem('preferredCurrency') || 'USD';
let exchangeRates = {};
let countryCurrencyMapping = {}; // Mapping of country names to their respective currency codes

// DOM Elements
const expenseForm = document.getElementById('expenseForm');
const expenseTableBody = document.getElementById('expenseTableBody');
const totalAmountElement = document.getElementById('totalAmount');
const preferredCurrencySelect = document.getElementById('preferredCurrency');
const expenseChart = document.getElementById('expenseChart');
const currencySelects = document.querySelectorAll('select[id$="currency"]');

// Fetch exchange rates
async function fetchExchangeRates() {
    try {
        console.log("Attempting to fetch exchange rates from API...");
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/USD`);
        
        if (!response.ok) {
            throw new Error('API call failed');
        }

        const data = await response.json();
        if (data.result !== "success") {
            throw new Error('API response was not successful');
        }

        exchangeRates = { USD: 1, ...data.conversion_rates };  // Ensure USD is the base
        console.log("Exchange rates fetched from API:", exchangeRates);

        // Populate both currency selects with available currencies from the API
        countryCurrencyMapping = getCountryCurrencyMapping(data.conversion_rates); // Map country to currency
        populateCountryCurrencySelects(countryCurrencyMapping);

        updateCurrencyFlags();
        updateDashboard();
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        
        // Fallback to static rates if API fails
        console.log("Using static exchange rates due to error with API.");
        exchangeRates = {
            USD: 1,
            EUR: 0.85,
            GBP: 0.73,
            JPY: 110.0,
            CAD: 1.25,
            AUD: 1.35
        };
        countryCurrencyMapping = getCountryCurrencyMapping(exchangeRates); // Fallback countries mapping
        populateCountryCurrencySelects(countryCurrencyMapping); // Populate selects with fallback mapping
        updateCurrencyFlags();
        updateDashboard();
    }
}

// Function to get country and currency mapping (for dropdown population)
function getCountryCurrencyMapping(currencies) {
    const mapping = {
        "United States": "USD",
        "Eurozone": "EUR",
        "United Kingdom": "GBP",
        "Japan": "JPY",
        "Canada": "CAD",
        "Australia": "AUD"
    };
    // Expand this mapping dynamically as needed by adding more countries

    // Add dynamic country to currency mapping based on available currencies
    Object.keys(currencies).forEach(currency => {
        if (!mapping[currency]) { // Only add countries that are not already mapped
            mapping[currency] = currency;
        }
    });
    
    return mapping;
}

// Function to populate country/currency dropdowns
function populateCountryCurrencySelects(mapping) {
    // Clear existing options
    currencySelects.forEach(select => {
        select.innerHTML = '';
        
        // Add an empty option at the top
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Country or Currency';
        select.appendChild(defaultOption);

        // Populate with all countries and their respective currencies
        Object.keys(mapping).forEach(country => {
            const option = document.createElement('option');
            option.value = mapping[country]; // Set currency as value
            option.textContent = `${country} - ${mapping[country]}`; // Show country and currency code
            select.appendChild(option);
        });
    });
}

// Update currency flags
async function updateCurrencyFlags() {
    const flagPromises = Array.from(currencySelects).map(async (select) => {
        const options = select.querySelectorAll('option');
        for (const option of options) {
            const currency = option.value;
            if (currency) {
                const countryCode = getCurrencyCountryCode(currency);
                try {
                    const flagUrl = `https://flagsapi.com/${countryCode}/flat/24.png`;
                    option.innerHTML = `<img src="${flagUrl}" alt="${currency}" style="width: 24px; vertical-align: middle; margin-right: 8px;"> ${option.textContent}`;
                } catch (error) {
                    console.error(`Error loading flag for ${currency}:`, error);
                }
            }
        }
    });
    await Promise.all(flagPromises);
}

// Helper function to get country code from currency
function getCurrencyCountryCode(currency) {
    const currencyToCountry = {
        USD: 'US',
        EUR: 'EU',
        GBP: 'GB',
        JPY: 'JP',
        CAD: 'CA',
        AUD: 'AU'
    };
    return currencyToCountry[currency] || currency; // Fallback to currency code if no country code found
}

// Initialize Chart.js
let chart;
function initializeChart() {
    const ctx = expenseChart.getContext('2d');
    chart = new Chart(ctx, {
        type: 'bar', // Change to 'bar' or another type depending on your preference
        data: {
            labels: [],
            datasets: [{
                label: 'Expenses by Category',
                data: [],
                backgroundColor: '#3b82f6', // Customize as needed
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

// Currency conversion
function convertAmount(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    const fromRate = exchangeRates[fromCurrency];
    const toRate = exchangeRates[toCurrency];
    return (amount / fromRate) * toRate;
}

// Update total and chart
function updateDashboard() {
    const total = expenses.reduce((sum, expense) => {
        const convertedAmount = convertAmount(expense.amount, expense.currency, preferredCurrency);
        return sum + convertedAmount;
    }, 0);
    totalAmountElement.textContent = `${preferredCurrency} ${total.toFixed(2)}`;

    // Update chart
    const categoryTotals = expenses.reduce((acc, expense) => {
        const convertedAmount = convertAmount(expense.amount, expense.currency, preferredCurrency);
        acc[expense.category] = (acc[expense.category] || 0) + convertedAmount;
        return acc;
    }, {});

    chart.data.labels = Object.keys(categoryTotals);
    chart.data.datasets[0].data = Object.values(categoryTotals);
    chart.update();
}

// Render expense list
function renderExpenses() {
    expenseTableBody.innerHTML = '';
    expenses.forEach((expense, index) => {
        const convertedAmount = convertAmount(expense.amount, expense.currency, preferredCurrency);
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${new Date(expense.date).toLocaleDateString()}</td>
            <td>${expense.description}</td>
            <td>${expense.category}</td>
            <td>${preferredCurrency} ${convertedAmount.toFixed(2)}</td>
            <td>
                <button class="btn-delete" onclick="deleteExpense(${index})">Delete</button>
            </td>
        `;
        expenseTableBody.appendChild(row);
    });
}

// Add expense
expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const expense = {
        amount: parseFloat(document.getElementById('amount').value),
        currency: document.getElementById('currency').value,
        description: document.getElementById('description').value,
        category: document.getElementById('category').value,
        date: new Date().toISOString()
    };
    expenses.push(expense);
    localStorage.setItem('expenses', JSON.stringify(expenses));
    expenseForm.reset();
    renderExpenses();
    updateDashboard(); // Update the dashboard after adding an expense
});

// Delete expense
function deleteExpense(index) {
    expenses.splice(index, 1);
    localStorage.setItem('expenses', JSON.stringify(expenses));
    renderExpenses();
    updateDashboard(); // Update the dashboard after deleting an expense
}

// Change preferred currency
preferredCurrencySelect.addEventListener('change', (e) => {
    preferredCurrency = e.target.value;
    localStorage.setItem('preferredCurrency', preferredCurrency);
    renderExpenses();
    updateDashboard(); // Update the dashboard after changing currency
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    preferredCurrencySelect.value = preferredCurrency;
    initializeChart();
    await fetchExchangeRates();
    renderExpenses();
    updateDashboard();
});
