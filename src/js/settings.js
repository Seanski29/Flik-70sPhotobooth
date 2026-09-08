document.addEventListener('DOMContentLoaded', () => {
    
    // A. Password Management
    const passwordForm = document.getElementById('password-form');
    const passwordError = document.getElementById('password-error');
    const passwordSuccess = document.getElementById('password-success');

    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;

        // Fetch current active password for validation
        const savedPassword = localStorage.getItem('operator_password') || "admin123";

        if (currentPass === savedPassword) { 
            // SAVE THE NEW PASSWORD GLOBALLY
            localStorage.setItem('operator_password', newPass);

            passwordError.style.display = 'none';
            passwordSuccess.style.display = 'block';
            passwordForm.reset();

            // Hide success message after 3 seconds for clean UI
            setTimeout(() => { passwordSuccess.style.display = 'none'; }, 3000);
        } else {
            passwordSuccess.style.display = 'none';
            passwordError.style.display = 'block';
        }
    });

    // B. Legal Modals
    const legalModal = document.getElementById('legal-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const closeModal = document.getElementById('close-modal');

    const documents = {
        privacy: {
            title: "FLIK Privacy Policy",
            html: `
                <p><strong>Effective date:</strong> September 8, 2026</p>
                <p>FLIK Photobooth is a local event-photography system operated by the event host or merchant. This policy explains how the application handles information during a booth session.</p>
                <h3>Information processed</h3>
                <ul>
                    <li>Photographs captured during a session, temporary camera files, generated collage files, and archive copies.</li>
                    <li>Operational information such as session count, revenue totals, selected frame, printer, device status, and operator account settings.</li>
                    <li>Technical data required by Windows, the connected camera, Arduino controller, printer, and digiCamControl.</li>
                </ul>
                <h3>How information is used</h3>
                <p>Photos are processed locally to create the selected print layout and to support reprinting or archive management. FLIK does not sell photographs or use them for advertising. The application is not designed to perform facial recognition, infer sensitive traits, or make decisions about people.</p>
                <h3>Where information is stored</h3>
                <p>By default, captures, frames, collages, configuration, and logs remain on the booth computer and its connected storage. FLIK does not provide a cloud gallery or automatically upload photographs. Windows, printer, camera, antivirus, backup, or network software may process files according to their own policies.</p>
                <h3>Event host responsibilities</h3>
                <p>The merchant or event host is responsible for providing any required notice, consent, model release, age-appropriate permissions, and lawful instructions for deleting or sharing photographs. Do not use FLIK to capture a person who has not agreed to be photographed.</p>
                <h3>Requests and contact</h3>
                <p>For questions, access, correction, or deletion requests, contact the event host or the FLIK service provider before the booth storage is wiped. This policy may be updated when the product or applicable requirements change.</p>
            `
        },
        eula: {
            title: "FLIK End User License Agreement",
            html: `
                <p><strong>Effective date:</strong> September 8, 2026</p>
                <p>This agreement grants the licensed merchant or event operator a limited, non-exclusive, non-transferable license to use the FLIK Photobooth software with authorized FLIK equipment for internal business and event operations.</p>
                <h3>Permitted use</h3>
                <p>You may operate the installed application, configure frames and printers, create prints, and maintain local backups for your events. You must keep the software and hardware under your control and follow applicable privacy, consumer-protection, copyright, and photography laws.</p>
                <h3>Restrictions</h3>
                <p>You may not copy, resell, sublicense, publish, reverse engineer, decompile, circumvent security controls, remove proprietary notices, or use the software to create an unauthorized competing service. You may not upload frames, music, logos, or photographs that you do not have permission to use.</p>
                <h3>Third-party components and equipment</h3>
                <p>FLIK relies on Windows, camera and printer drivers, digiCamControl, Arduino hardware, and open-source packages. Those components are subject to their own licenses and may require separate updates or support.</p>
                <h3>Availability and liability</h3>
                <p>The software is provided for event operations and may be affected by power, camera, USB, network, printer, driver, or storage failures. Maintain backups and test the complete capture-to-print workflow before an event. To the extent permitted by law, the provider is not liable for indirect loss, missed prints, lost files, or unauthorized use caused by operator configuration or third-party equipment.</p>
                <h3>Termination</h3>
                <p>This license ends if you breach this agreement or stop being authorized to use the FLIK system. On termination, stop using the software and delete copies that are not part of an authorized backup.</p>
            `
        },
        security: {
            title: "FLIK Information Security",
            html: `
                <h3>Security objectives</h3>
                <p>FLIK is designed as a local-first kiosk. Keep the booth computer, its operating system, and connected equipment under the control of authorized staff.</p>
                <h3>Operator access</h3>
                <ul>
                    <li>Use a unique operator password and change it when staff or contractors change.</li>
                    <li>Lock or sign out of Windows when the booth is unattended.</li>
                    <li>Limit access to the archive, frame library, configuration, and backups to trusted operators.</li>
                    <li>Do not store passwords in frames, logs, filenames, or event notes.</li>
                </ul>
                <h3>Device and network controls</h3>
                <p>Apply Windows security updates, use reputable endpoint protection, disable unnecessary remote access, and use a protected network when network access is required. Keep the camera, Arduino, and printer firmware and drivers supported by their manufacturers.</p>
                <h3>Media and backups</h3>
                <p>Protect removable drives and backups like the original photographs. Encrypt or physically secure backups where supported by the operating system, and securely erase media before disposal or reassignment.</p>
            `
        },
        retention: {
            title: "FLIK Data Retention & Deletion",
            html: `
                <h3>Default retention</h3>
                <p>FLIK keeps temporary captures while a session is being assembled and may keep generated collages and source files in the local archive so an operator can review or reprint them. The software does not define a universal retention period because event hosts have different needs and legal duties.</p>
                <h3>Recommended practice</h3>
                <p>Before each event, set a documented deletion date with the merchant or event host. After that date, delete archived photographs, temporary exports, USB copies, cloud backups, and printed rejects that are no longer needed. Keep only records required for accounting, support, or a documented consent agreement.</p>
                <h3>Deletion procedure</h3>
                <p>Use the archive controls, empty the recycle bin, remove exported copies, and verify backup and printer folders. For sensitive events, use an operating-system secure erase or encrypted storage policy appropriate to the device.</p>
            `
        },
        incident: {
            title: "FLIK Incident Response",
            html: `
                <h3>Examples of an incident</h3>
                <p>An incident includes a lost booth computer or drive, unauthorized archive access, accidental disclosure, malware, a stolen backup, or a print containing the wrong person's image.</p>
                <h3>Immediate steps</h3>
                <ol>
                    <li>Stop capture and printing if continued operation could expose more information.</li>
                    <li>Disconnect the affected computer or storage from networks, but do not destroy evidence.</li>
                    <li>Restrict access and record the time, device, event, affected files, and people notified.</li>
                    <li>Notify the merchant or event host promptly and follow their legal, insurer, and regulator notification requirements.</li>
                    <li>Change affected passwords, preserve relevant logs, scan or rebuild compromised devices, and restore only from trusted backups.</li>
                </ol>
                <h3>After the event</h3>
                <p>Document the cause, affected data, corrective actions, and lessons learned. Review retention, staff access, backups, and physical security before the booth returns to service.</p>
            `
        }
    };

    const openDocument = (key) => {
        const document = documents[key];
        modalTitle.textContent = document.title;
        modalText.innerHTML = document.html;
        legalModal.style.display = 'flex';
    };

    document.getElementById('btn-privacy').addEventListener('click', () => openDocument('privacy'));
    document.getElementById('btn-eula').addEventListener('click', () => openDocument('eula'));
    document.getElementById('btn-security').addEventListener('click', () => openDocument('security'));
    document.getElementById('btn-retention').addEventListener('click', () => openDocument('retention'));
    document.getElementById('btn-incident').addEventListener('click', () => openDocument('incident'));

    closeModal.addEventListener('click', () => {
        legalModal.style.display = 'none';
    });
});