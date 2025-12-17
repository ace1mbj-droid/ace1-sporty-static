// ===================================
// WEBSITE IMAGE MANAGER FOR ADMIN
// ===================================
// Comprehensive image management system for all website images

class WebsiteImageManager {
    constructor() {
        this.supabase = null;
        this.imageCategories = {
            hero: { name: 'Hero/Banner Images', selector: '.hero-section, .banner', images: [] },
            products: { name: 'Product Images', selector: '.product-card img, .product-image', images: [] },
            categories: { name: 'Category Images', selector: '.category-card img', images: [] },
            logos: { name: 'Logos & Branding', selector: '.logo, .brand-logo', images: [] },
            features: { name: 'Feature/Icon Images', selector: '.feature-icon, .benefits img', images: [] },
            team: { name: 'Team/About Images', selector: '.team-member img, .about-image', images: [] },
            testimonials: { name: 'Testimonial Images', selector: '.testimonial img', images: [] },
            other: { name: 'Other Images', selector: '', images: [] }
        };
        this.init();
    }

    async init() {
        this.supabase = window.getSupabase();
        console.log('✅ Website Image Manager initialized');
    }

    // ===================================
    // RENDER IMAGE MANAGER UI
    // ===================================
    renderImageManager(containerId = 'image-manager-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Image manager container not found');
            return;
        }

        let html = `
            <div class="image-manager">
                <div class="image-manager-header">
                    <h2><i class="fas fa-images"></i> Website Image Manager</h2>
                    <p>Manage all images across your website from one place</p>
                </div>

                <div class="image-manager-tabs">
                    ${Object.keys(this.imageCategories).map((key, index) => `
                        <button class="img-tab ${index === 0 ? 'active' : ''}" data-category="${key}">
                            ${this.imageCategories[key].name}
                        </button>
                    `).join('')}
                </div>

                <div class="image-manager-content">
                    ${Object.keys(this.imageCategories).map((key, index) => `
                        <div class="img-category-content ${index === 0 ? 'active' : ''}" data-category="${key}">
                            <div class="category-actions">
                                <button class="btn-primary" onclick="websiteImageManager.scanImages('${key}')">
                                    <i class="fas fa-sync"></i> Scan for Images
                                </button>
                                <button class="btn-secondary" onclick="websiteImageManager.uploadNewImage('${key}')">
                                    <i class="fas fa-upload"></i> Upload New Image
                                </button>
                            </div>
                            <div id="images-${key}" class="images-grid">
                                <p class="no-images">Click "Scan for Images" to load images in this category</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Upload Modal -->
                <div id="upload-modal" class="modal">
                    <div class="modal-content">
                        <span class="close" onclick="websiteImageManager.closeUploadModal()">&times;</span>
                        <h3>Upload New Image</h3>
                        <form id="image-upload-form">
                            <div class="form-group">
                                <label>Image Category</label>
                                <select id="upload-category" required>
                                    ${Object.keys(this.imageCategories).map(key => `
                                        <option value="${key}">${this.imageCategories[key].name}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Image File</label>
                                <input type="file" id="image-file" accept="image/*" required>
                                <small>Recommended: JPG, PNG, WebP (Max 5MB)</small>
                            </div>
                            <div class="form-group">
                                <label>Image URL (or upload file above)</label>
                                <input type="url" id="image-url" placeholder="https://example.com/image.jpg">
                            </div>
                            <div class="form-group">
                                <label>Alt Text / Description</label>
                                <input type="text" id="image-alt" placeholder="Product name, description, etc." required>
                            </div>
                            <div class="form-group">
                                <label>Apply To</label>
                                <select id="apply-location">
                                    <option value="database">Save to Database Only</option>
                                    <option value="specific">Update Specific Element (Advanced)</option>
                                </select>
                            </div>
                            <div class="form-group" id="selector-group" style="display:none;">
                                <label>CSS Selector (e.g., #hero-banner, .logo)</label>
                                <input type="text" id="element-selector" placeholder=".hero-section img">
                            </div>
                            <button type="submit" class="btn-submit">
                                <i class="fas fa-upload"></i> Upload & Apply
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Edit Modal -->
                <div id="edit-modal" class="modal">
                    <div class="modal-content">
                        <span class="close" onclick="websiteImageManager.closeEditModal()">&times;</span>
                        <h3>Edit Image</h3>
                        <div id="edit-preview" class="edit-preview"></div>
                        <form id="image-edit-form">
                            <div class="form-group">
                                <label>Image URL</label>
                                <input type="url" id="edit-url" required placeholder="https://example.com/image.jpg">
                                <small>Enter the full URL to the image</small>
                            </div>
                            <div class="form-group">
                                <label>Alt Text</label>
                                <input type="text" id="edit-alt" placeholder="Image description">
                            </div>
                            <input type="hidden" id="edit-selector">
                            <input type="hidden" id="edit-id">
                            <button type="submit" class="btn-submit">
                                <i class="fas fa-save"></i> Save URL
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.attachEventListeners();
    }

    // ===================================
    // SCAN FOR IMAGES ON PAGES
    // ===================================
    async scanImages(category) {
        const container = document.getElementById(`images-${category}`);
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Scanning images...</div>';

        try {
            // Get pages to scan
            const pages = [
                { url: 'index.html', name: 'Homepage' },
                { url: 'products.html', name: 'Products' },
                { url: 'about.html', name: 'About' },
                { url: 'technology.html', name: 'Technology' }
            ];

            let allImages = [];

            // For product images, get from database
            if (category === 'products') {
                const { data: products } = await this.supabase
                    .from('products')
                    .select(`
                        id, 
                        name,
                        product_images (
                            storage_path,
                            alt
                        )
                    `)
                    .limit(50);

                if (products) {
                    allImages = products.map(p => ({
                        src: p.product_images?.[0]?.storage_path,
                        alt: p.product_images?.[0]?.alt || p.name,
                        location: 'Database - Products',
                        id: p.id,
                        type: 'product'
                    }));
                }
            } else {
                // Scan HTML pages (this is a placeholder - in production, you'd fetch and parse HTML)
                // For now, we'll show placeholder data
                allImages = this.getPlaceholderImages(category);
            }

            this.renderImagesGrid(allImages, category, container);

        } catch (error) {
            console.error('Scan error:', error);
            container.innerHTML = '<p class="error">Failed to scan images. Please try again.</p>';
        }
    }

    // ===================================
    // RENDER IMAGES GRID
    // ===================================
    renderImagesGrid(images, category, container) {
        if (!images || images.length === 0) {
            container.innerHTML = '<p class="no-images">No images found in this category</p>';
            return;
        }

        let html = '<div class="images-grid-container">';
        
        images.forEach((img, index) => {
            html += `
                <div class="image-card">
                    <div class="image-preview">
                        <img src="${img.src || 'placeholder.jpg'}" alt="${img.alt || 'Image'}" 
                             onerror="this.src='https://via.placeholder.com/300x200?text=Image+Not+Found'">
                    </div>
                    <div class="image-info">
                        <p class="image-location"><i class="fas fa-map-marker-alt"></i> ${img.location}</p>
                        <p class="image-alt">${img.alt || 'No description'}</p>
                        <div class="image-actions">
                            <button class="btn-edit" onclick='websiteImageManager.editImage(${JSON.stringify(img).replace(/'/g, "&#39;")})'>
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn-replace" onclick='websiteImageManager.replaceImage(${JSON.stringify(img).replace(/'/g, "&#39;")})'>
                                <i class="fas fa-sync-alt"></i> Replace
                            </button>
                            ${img.type === 'product' ? `
                                <button class="btn-delete" onclick="websiteImageManager.deleteImage('${img.id}', 'product')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // ===================================
    // UPLOAD NEW IMAGE
    // ===================================
    uploadNewImage(category) {
        const modal = document.getElementById('upload-modal');
        document.getElementById('upload-category').value = category;
        modal.style.display = 'block';
    }

    // ===================================
    // EDIT IMAGE
    // ===================================
    editImage(imageData) {
        const modal = document.getElementById('edit-modal');
        const preview = document.getElementById('edit-preview');
        
        preview.innerHTML = `<img src="${imageData.src}" alt="${imageData.alt}">`;
        document.getElementById('edit-url').value = imageData.src || '';
        document.getElementById('edit-alt').value = imageData.alt || '';
        document.getElementById('edit-selector').value = imageData.selector || '';
        document.getElementById('edit-id').value = imageData.id || '';
        
        modal.style.display = 'block';
        this.currentEditImage = imageData;
    }

    // ===================================
    // REPLACE IMAGE
    // ===================================
    async replaceImage(imageData) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                // Show loading
                this.showNotification('Uploading image...', 'info');

                // Upload to Supabase Storage or your preferred service
                const imageUrl = await this.uploadImageFile(file);

                // Update database if it's a product image
                if (imageData.type === 'product') {
                    // Update product_images table instead of products.image_url
                    const { data: existingImage } = await this.supabase
                        .from('product_images')
                        .select('*')
                        .eq('product_id', imageData.id)
                        .limit(1)
                        .single();

                    if (existingImage) {
                        // Update existing image
                        const { error } = await this.supabase
                            .from('product_images')
                            .update({ 
                                storage_path: imageUrl,
                                alt: 'Product image'
                            })
                            .eq('product_id', imageData.id);

                        if (error) throw error;
                    } else {
                        // Create new image record
                        const { error } = await this.supabase
                            .from('product_images')
                            .insert([{
                                product_id: imageData.id,
                                storage_path: imageUrl,
                                alt: 'Product image',
                                position: 1
                            }]);

                        if (error) throw error;
                    }
                }

                this.showNotification('Image replaced successfully!', 'success');
                
                // Refresh the grid
                const category = this.getCurrentCategory();
                await this.scanImages(category);

            } catch (error) {
                console.error('Replace error:', error);
                this.showNotification('Failed to replace image', 'error');
            }
        };

        input.click();
    }

    // ===================================
    // DELETE IMAGE
    // ===================================
    async deleteImage(id, type) {
        if (!confirm('Are you sure you want to delete this image?')) return;

        try {
            if (type === 'product') {
                // Delete from product_images table instead of setting products.image_url to null
                const { error } = await this.supabase
                    .from('product_images')
                    .delete()
                    .eq('product_id', id);

                if (error) throw error;
            }

            this.showNotification('Image deleted successfully!', 'success');
            
            // Refresh
            const category = this.getCurrentCategory();
            await this.scanImages(category);

        } catch (error) {
            console.error('Delete error:', error);
            this.showNotification('Failed to delete image', 'error');
        }
    }

    // ===================================
    // UPLOAD IMAGE FILE
    // ===================================
    async uploadImageFile(file, category = 'other') {
        if (!this.supabase) this.supabase = window.getSupabase && window.getSupabase();
        if (!this.supabase) throw new Error('Supabase client not initialized');

        // Basic validation
        const maxBytes = 5 * 1024 * 1024; // 5MB
        if (file.size > maxBytes) throw new Error('File too large. Max 5MB');

        const safeName = (file.name || 'image').replace(/[^a-zA-Z0-9_.-]/g, '_');
        const ts = Date.now();
        const path = `Site/${category}/${ts}_${safeName}`;

        const { error: uploadError } = await this.supabase
            .storage
            .from('Images')
            .upload(path, file, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type || 'application/octet-stream'
            });

        if (uploadError) throw uploadError;

        const { data } = this.supabase
            .storage
            .from('Images')
            .getPublicUrl(path);

        if (!data || !data.publicUrl) throw new Error('Failed to obtain public URL');
        return data.publicUrl;
    }

    // ===================================
    // PLACEHOLDER DATA
    // ===================================
    getPlaceholderImages(category) {
        const placeholders = {
            hero: [
                { src: 'images/hero-banner.jpg', alt: 'Hero Banner', location: 'Homepage Hero Section' }
            ],
            logos: [
                { src: 'images/logo.png', alt: 'Ace#1 Logo', location: 'Header Navigation' }
            ],
            features: [
                { src: 'images/feature1.jpg', alt: 'Feature 1', location: 'Homepage Features' },
                { src: 'images/feature2.jpg', alt: 'Feature 2', location: 'Homepage Features' }
            ]
        };

        return placeholders[category] || [];
    }

    // ===================================
    // HELPER METHODS
    // ===================================
    getCurrentCategory() {
        const activeTab = document.querySelector('.img-tab.active');
        return activeTab ? activeTab.dataset.category : 'products';
    }

    closeUploadModal() {
        document.getElementById('upload-modal').style.display = 'none';
    }

    closeEditModal() {
        document.getElementById('edit-modal').style.display = 'none';
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ===================================
    // ATTACH EVENT LISTENERS
    // ===================================
    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('.img-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.img-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.img-category-content').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                const category = e.target.dataset.category;
                document.querySelector(`[data-category="${category}"].img-category-content`).classList.add('active');
            });
        });

        // Upload form
        const uploadForm = document.getElementById('image-upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const category = document.getElementById('upload-category').value || 'other';
                    const fileInput = document.getElementById('image-file');
                    const urlInput = document.getElementById('image-url');
                    const altInput = document.getElementById('image-alt');
                    const applyLoc = document.getElementById('apply-location').value;
                    const selector = document.getElementById('element-selector').value;

                    if (!fileInput.files[0] && !urlInput.value) {
                        this.showNotification('Please choose a file or provide a URL', 'error');
                        return;
                    }

                    let publicUrl = urlInput.value.trim();
                    if (fileInput.files[0]) {
                        this.showNotification('Uploading image...', 'info');
                        publicUrl = await this.uploadImageFile(fileInput.files[0], category);
                    }

                    // If apply to specific selector, try to update DOM immediately
                    if (applyLoc === 'specific' && selector) {
                        try {
                            document.querySelectorAll(selector).forEach(el => {
                                if (el.tagName === 'IMG') el.src = publicUrl;
                                else if (el.style) el.style.backgroundImage = `url('${publicUrl}')`;
                            });
                        } catch (_) { /* ignore selector issues */ }
                    }

                    // For now we just upload and provide the URL; future: persist mapping in DB
                    this.showNotification('Image uploaded successfully', 'success');
                    try {
                        await navigator.clipboard.writeText(publicUrl);
                        this.showNotification('Copied URL to clipboard', 'success');
                    } catch (_) { /* clipboard may fail */ }

                    // Refresh current category grid (if products, user should use product editor)
                    const cat = this.getCurrentCategory();
                    await this.scanImages(cat);
                    this.closeUploadModal();
                } catch (err) {
                    console.error('Upload error:', err);
                    const msg = err?.message || 'Upload failed';
                    this.showNotification(msg, 'error');
                }
            });
        }

        // Edit form
        const editForm = document.getElementById('image-edit-form');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const url = document.getElementById('edit-url').value;
                const alt = document.getElementById('edit-alt').value;
                const selector = document.getElementById('edit-selector').value;
                const id = document.getElementById('edit-id').value;
                
                try {
                    if (!this.supabase) this.supabase = window.getSupabase && window.getSupabase();
                    
                    // Save to database if it's a product image
                    if (id) {
                        const { error } = await this.supabase
                            .from('product_images')
                            .update({
                                storage_path: url,
                                alt: alt
                            })
                            .eq('product_id', id);
                        
                        if (error) throw error;
                    }
                    
                    // Update the DOM element if selector exists
                    if (selector) {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => {
                            if (el.tagName === 'IMG') {
                                el.src = url;
                                if (alt) el.alt = alt;
                            } else {
                                el.style.backgroundImage = `url('${url}')`;
                            }
                        });
                    }
                    
                    this.showNotification('Image URL saved successfully!', 'success');
                    this.closeEditModal();
                    
                    // Refresh the grid
                    const category = this.getCurrentCategory();
                    await this.scanImages(category);
                    
                } catch (error) {
                    console.error('Save error:', error);
                    this.showNotification('Failed to save image URL', 'error');
                }
            });
        }

        // Apply location selector visibility
        const applyLocation = document.getElementById('apply-location');
        if (applyLocation) {
            applyLocation.addEventListener('change', (e) => {
                const selectorGroup = document.getElementById('selector-group');
                selectorGroup.style.display = e.target.value === 'specific' ? 'block' : 'none';
            });
        }
    }
}

// Initialize
const websiteImageManager = new WebsiteImageManager();
window.websiteImageManager = websiteImageManager;

console.log('✅ Website Image Manager loaded');
