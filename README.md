# AutoStelle: Parking Occupancy and Booking System

## Description

AutoStelle is an IoT-enabled parking occupancy and booking system that provides real-time monitoring of parking slot availability. Utilizing ultrasonic sensors, an ESP32 microcontroller, and RFID authentication, AutoStelle allows users to remotely check parking slot status and book reserved slots. This system enhances parking management and provides a seamless experience for users.

## Features and Functionality

*   **Real-time Parking Occupancy Monitoring:** Utilizes ultrasonic sensors to detect whether a parking slot is occupied.
*   **Remote Monitoring:** Accessible via a web interface, allowing users to view parking slot availability from anywhere.
*   **Reserved Parking Booking:** Enables users to reserve specific parking slots using RFID authentication.
*   **Admin Interface:** Allows administrators to manage authorized users, assign RFID tags, and view parking data.
*   **User Authentication:** Firebase Authentication is used for secure admin login.
*   **Dynamic Slot Adjustment:** The number of normal and reserved slots can be adjusted using sliders in control panel.
*   **UID Management:** Administrators can add, remove, search, sort and bulk delete user UIDs associated with parking reservations through the admin interface.

## Technology Stack

*   **Frontend:** HTML, CSS, JavaScript
*   **Backend:** ESP32 microcontroller
*   **Database:** Firebase Realtime Database
*   **Authentication:** Firebase Authentication

## Prerequisites

Before running AutoStelle, ensure you have the following:

*   **Web Browser:** A modern web browser (e.g., Chrome, Firefox, Safari).
*   **Firebase Account:** A Firebase project with Realtime Database and Authentication enabled.
*   **ESP32 Development Environment:** Configured for your specific ESP32 setup (not covered in provided files).
*   **Node.js and npm (Optional):** Required if you plan to modify and bundle the JavaScript files.

## Installation Instructions

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/EagleStelle/AutoStelle.git
    cd AutoStelle
    ```

2.  **Firebase Configuration:**

    *   Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/).
    *   Enable Realtime Database and Authentication.
    *   Replace the placeholder values in `scripts/firebase.js` with your Firebase project credentials.

    ```javascript
    // scripts/firebase.js
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID",
      databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app"
    };
    ```

3.  **Open HTML Files:**

    *   Open `login.html` in your web browser to access the login page.
    *   Open `index.html` in your web browser after successful login.

## Usage Guide

1.  **Login:**

    *   Open `login.html` in your browser.
    *   Enter your registered email and password.
    *   Click the "Log In" button.
    *   Alternatively, you can continue as user by clicking the "Continue as User" button to view the parking status without logging in.

2.  **Admin Interface:**

    *   After logging in as an administrator, the system redirects you to the main interface (`index.html`). Double click on the AutoStelle branding text to switch to the admin mode.
    *   Toggle between User and Admin modes using the gear icon in the footer.
    *   In Admin mode, you can:
        *   View and manage authorized UIDs.
        *   Add new RFID tags and associate them with user details (name, license plate).
        *   Delete existing RFID tag entries.
        *   Search for users using the search bar.
        *   Sort the entries by UID, Name or Plate.
        *   Bulk delete selected UIDs.

3.  **Reserving a Parking Slot:**

    *   In Admin mode, click the "Reserve" button.
    *   Enter the user's name and license plate number in the "Add New Reservation" modal.
    *   Click "Confirm".
    *   Scan the RFID tag using the RFID reader connected to the ESP32.
    *   The system will associate the scanned RFID tag with the provided user details.

4.  **Monitoring Parking Slots:**

    *   Open `index.html` in your browser.
    *   The main interface displays the real-time status of each parking slot (occupied or vacant).

5.  **Adjusting Slot Counts:**
    * In either User or Admin mode, sliders on the footer control panel can be used to adjust the number of normal and reserved parking slots.

## API Documentation

This project uses Firebase Realtime Database, and interacts directly with its API using the Firebase JavaScript SDK. The `scripts/firebase.js` file initializes the connection to Firebase. All other javascripts utilize this connection.

*   **Firebase Realtime Database:**

    *   `ref(db, path)`: Creates a reference to the specified path in the database.
    *   `onValue(ref, callback)`: Listens for changes at the specified database reference.
    *   `set(ref, value)`: Writes data to the specified database reference.
    *   `get(ref)`: Retrieves data once from the specified database reference.
    *   `remove(ref)`: Deletes the data at the specified database reference.

*   **Firebase Authentication:**

    *   `signInWithEmailAndPassword(auth, email, password)`: Signs in a user with an email and password.
    *   `signOut(auth)`: Signs out the current user.
    *   `onAuthStateChanged(auth, callback)`: Listens for changes in the user's authentication state.

## Contributing Guidelines

Contributions to AutoStelle are welcome! To contribute:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them with descriptive messages.
4.  Submit a pull request to the `main` branch.

Please ensure your code adheres to the project's coding standards and includes relevant tests.

## License Information

This project does not have a specified license. All rights are reserved by the owner.
Please contact the owner for permissions regarding distribution, modification, or commercial use.

## Contact/Support Information

For questions, bug reports, or feature requests, please contact the project maintainers through the GitHub repository.

*   **GitHub:** [https://github.com/EagleStelle/AutoStelle](https://github.com/EagleStelle/AutoStelle)