// Real-time Stats Management
const supabase = window.getSupabase();

// Initialize stats
async function loadStats() {
    try {
        // Get total customers (from users or orders table)
        const { count: customerCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        // Get satisfaction data from surveys
        const { data: surveys, error: surveyError } = await supabase
            .from('surveys')
            .select('satisfaction, recommend, country');

        if (surveyError && surveyError.code !== 'PGRST116') {
            console.log('Surveys table not found, using default values');
        }

        // Get product count
        const { count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });

        // Calculate satisfaction rate
        let satisfactionRate = 98; // Default
        let uniqueCountries = 40; // Default

        if (surveys && surveys.length > 0) {
            // Calculate average satisfaction (out of 5 stars)
            const avgSatisfaction = surveys.reduce((sum, s) => sum + parseInt(s.satisfaction), 0) / surveys.length;
            satisfactionRate = Math.round((avgSatisfaction / 5) * 100);

            // Count unique countries
            const countries = [...new Set(surveys.map(s => s.country).filter(Boolean))];
            uniqueCountries = countries.length;
        }

        // Update UI with animation
        animateValue('happy-customers', 0, customerCount || 150, 2000, '+');
        animateValue('satisfaction-rate', 0, satisfactionRate, 2000, '%');
        animateValue('product-models', 0, productCount || 4, 2000, '+');
        animateValue('countries-served', 0, uniqueCountries, 2000, '+');

    } catch (error) {
        console.error('Error loading stats:', error);
        // Use default values
        animateValue('happy-customers', 0, 150, 2000, '+');
        animateValue('satisfaction-rate', 0, 98, 2000, '%');
        animateValue('product-models', 0, 4, 2000, '+');
        animateValue('countries-served', 0, 40, 2000, '+');
    }
}

// Animate number counting
function animateValue(id, start, end, duration, suffix = '') {
    const element = document.getElementById(id);
    if (!element) return;

    const range = end - start;
    const increment = range / (duration / 16); // 60fps
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current) + suffix;
    }, 16);
}

// Survey Modal Functions
function openSurvey() {
    document.getElementById('surveyModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeSurvey() {
    document.getElementById('surveyModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    // Reset form
    document.getElementById('surveyForm').reset();
    document.getElementById('surveyForm').style.display = 'block';
    document.getElementById('thankYouMessage').style.display = 'none';
}

// Handle survey submission
document.addEventListener('DOMContentLoaded', () => {
    // Load stats on page load
    loadStats();

    const surveyForm = document.getElementById('surveyForm');
    if (surveyForm) {
        surveyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(surveyForm);
            const surveyData = {
                satisfaction: parseInt(formData.get('satisfaction')),
                recommend: formData.get('recommend'),
                country: formData.get('country'),
                comments: formData.get('comments') || null,
                created_at: new Date().toISOString()
            };

            try {
                // Try to insert survey data
                const { error } = await supabase
                    .from('surveys')
                    .insert([surveyData]);

                if (error) {
                    // If table doesn't exist, create it
                    if (error.code === '42P01') {
                        console.log('Surveys table needs to be created in Supabase');
                        showNotification('Thank you for your feedback! (Data storage pending setup)', 'info');
                    } else {
                        throw error;
                    }
                } else {
                    // Show thank you message
                    surveyForm.style.display = 'none';
                    document.getElementById('thankYouMessage').style.display = 'block';

                    // Reload stats after 2 seconds
                    setTimeout(() => {
                        loadStats();
                        setTimeout(closeSurvey, 2000);
                    }, 2000);
                }
            } catch (error) {
                console.error('Error submitting survey:', error);
                showNotification('Thank you for your feedback!', 'success');
                surveyForm.style.display = 'none';
                document.getElementById('thankYouMessage').style.display = 'block';
                setTimeout(closeSurvey, 3000);
            }
        });
    }

    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('surveyModal');
        if (event.target === modal) {
            closeSurvey();
        }
    }
});

// Reload stats every 30 seconds
setInterval(loadStats, 30000);
