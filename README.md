MobilEASE
<img src="./public/logo.png" alt="logo" width=200 height=200>

A Web-Based Traffic Complaint System that can be used by citizens for reporting various traffic and civic issues.

Background / Problem Statement
The problem addressed by MobilEASE is the prevalence of traffic chaos in urban areas due to a lack of efficient means for citizens to report incidents. The current system of reporting traffic incidents is often cumbersome, time-consuming, and ineffective, resulting in delayed resolution and increased frustration among citizens. This has led to a lack of accountability and transparency in governance and has negatively impacted the quality of life in cities. The proposed solution seeks to provide a user-friendly and convenient platform for citizens to report traffic incidents directly from their mobile devices. The system will utilize GPS technology to pinpoint the location of incidents and allow users to upload photos and videos as evidence, promoting a culture of civic responsibility and collaboration.

Features
Two types of users - citizen and official

Progressive Web App (PWA)

Completely Mobile Responsive

Only citizen users can be created using the webpage, official credentials are given by an admin

Ability to attach video/image of the incident while reporting

Ability to track reported complaints

Screenshots
Home Page

Login Page

Report Complaint Page

Official Dashboard

Detailed Complaint View

Citizen Dashboard

Languages, Frameworks, & Tools
Figma for designing

Vite + ReactJS

Firebase as database (Firestore) and cloud storage

Tailwind CSS for styling

Material UI (MUI) for some components (Dialog, DataGrid, etc.)

Getting Started
Clone the repository:

$ git clone [your-repository-url]

Install all dependencies:

$cd mobileEASE-main$ npm install

Create a Firebase project and create a .env file in your local directory containing the configuration of that project. (Refer to env.example for the variable names).

Run the development server:

$ npm run dev

The application will be running at http://localhost:5173.

License
This project is licensed under the MIT License. See the LICENSE file for details.
