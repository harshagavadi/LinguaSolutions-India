import React from 'react';

export const PrivacyPolicy = () => (
  <div className="max-w-4xl mx-auto px-6 py-12 prose prose-blue">
    <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
    <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>
    
    <h2 className="text-xl font-semibold mt-8 mb-4">1. Introduction</h2>
    <p>Welcome to LinguaSolutions India. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you visit our website.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">2. The Data We Collect</h2>
    <p>We do not require user accounts. We may collect information about how you use our website, including:</p>
    <ul className="list-disc pl-6 mb-4">
      <li>Technical Data: IP address, browser type, and version.</li>
      <li>Usage Data: Information about how you use our website and services.</li>
    </ul>

    <h2 className="text-xl font-semibold mt-8 mb-4">3. Cookies and Advertising</h2>
    <p>We use Google AdSense and other third-party services to serve ads on our website. To comply with Google AdSense policies, we disclose the following:</p>
    <ul className="list-disc pl-6 mb-4">
      <li><strong>Google Ads:</strong> Google, as a third-party vendor, uses cookies to serve ads on our site. Google's use of advertising cookies enables it and its partners to serve ads to our users based on their visit to our site and/or other sites on the Internet.</li>
      <li><strong>Opting Out:</strong> You may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Ads Settings</a>. Alternatively, you can opt out of a third-party vendor's use of cookies for personalized advertising by visiting <a href="http://www.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.aboutads.info</a>.</li>
      <li><strong>Third-party cookies:</strong> Other third-party vendors or ad networks may also use cookies to serve ads on our site. These cookies are used to track your behavior across different websites and to serve you relevant advertisements.</li>
    </ul>

    <h2 className="text-xl font-semibold mt-8 mb-4">4. Managing Your Privacy</h2>
    <p>Most web browsers allow you to control cookies through their settings. You can set your browser to block all cookies or to indicate when a cookie is being sent. However, some sections of our website may not function properly if you disable cookies.</p>
    <p>For more information on how Google uses data when you use our partners' sites or apps, please visit <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google's Privacy & Terms</a>.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">5. Data Processing & AI</h2>
    <p>All translations are processed using Google Gemini AI. Files uploaded for translation are processed in real-time and are not stored permanently on our servers after the session ends.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">6. International Data Transfers (GDPR/LGPD)</h2>
    <p>Our website is accessible globally. If you are a resident of the European Economic Area (EEA) or Brazil, you have specific rights under the GDPR and LGPD respectively, including the right to access, correct, or delete your personal data. As we rely on cookies for advertising, we satisfy these requirements through transparency and by providing opt-out mechanisms.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">7. Contact</h2>
    <p>If you have any questions about this privacy policy, please contact us at indianmovies30@gmail.com.</p>
  </div>
);

export const AboutUs = () => (
  <div className="max-w-4xl mx-auto px-6 py-12 prose prose-blue">
    <h1 className="text-3xl font-bold mb-6">About Us</h1>
    <p className="text-lg leading-relaxed mb-6">LinguaSolutions India is a professional language technology provider dedicated to breaking down communication barriers through the power of advanced Artificial Intelligence.</p>
    
    <h2 className="text-xl font-semibold mt-8 mb-4">Our Vision</h2>
    <p>We believe that language should never be a barrier to opportunity, business, or connection. Our platform leverages the latest breakthroughs in Large Language Models (LLMs) to provide human-grade translation accuracy for documents, images, and text.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Why India Intelligence?</h2>
    <p>Based in India, we understand the incredible linguistic diversity of the subcontinent. Our tools are optimized not just for global languages, but with a deep understanding of the context and nuances required for high-stakes professional translation.</p>
    
    <h2 className="text-xl font-semibold mt-8 mb-4">Contact Information</h2>
    <p>LinguaSolutions India team can be reached via email for partnerships, feedback, or support.</p>
    <p className="font-bold">Email: indianmovies30@gmail.com</p>
  </div>
);

export const ContactUs = () => (
  <div className="max-w-4xl mx-auto px-6 py-12 prose prose-blue">
    <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
    <p className="mb-8 text-gray-600">Have a question or need support with our translation services? We're here to help.</p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
        <h3 className="text-lg font-bold mb-2">Technical Support</h3>
        <p className="text-sm text-gray-600 mb-4">Issues with OCR, file translation, or API access.</p>
        <span className="text-blue-600 font-bold">support@linguasolutions.in</span>
      </div>
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
        <h3 className="text-lg font-bold mb-2">Business Inquiries</h3>
        <p className="text-sm text-gray-600 mb-4">Bulk translation projects or custom AI solutions.</p>
        <span className="text-gray-900 font-bold">business@linguasolutions.in</span>
      </div>
    </div>

    <div className="p-8 bg-white border border-gray-200 rounded-3xl shadow-sm">
      <h3 className="text-xl font-bold mb-4">Send us a message</h3>
      <p className="text-sm text-gray-400 mb-6 italic">Direct message feature coming soon. In the meantime, please use the email below.</p>
      <div className="flex items-center gap-2 text-lg">
        <span className="text-gray-500">Official Email:</span>
        <a href="mailto:indianmovies30@gmail.com" className="text-blue-600 font-bold hover:underline">indianmovies30@gmail.com</a>
      </div>
    </div>
  </div>
);

export const TermsOfService = () => (
  <div className="max-w-4xl mx-auto px-6 py-12 prose prose-blue">
    <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
    <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
    <p>By accessing or using LinguaSolutions India, you agree to be bound by these Terms of Service.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">2. Use of Service</h2>
    <p>You agree to use our translation services for lawful purposes only. You are responsible for any content you upload for translation.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">3. Disclaimers</h2>
    <p>Our services are provided "as is". While we strive for high accuracy using AI, we do not guarantee that translations are error-free. We are not liable for any damages arising from the use of our translations.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">4. Intellectual Property</h2>
    <p>The website design, logo, and original content are the property of LinguaSolutions India.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">5. Modifications</h2>
    <p>We reserve the right to modify these terms at any time. Your continued use of the site constitutes acceptance of the new terms.</p>
  </div>
);
