import React from 'react';
import '../styles/Footer.css';
import { FaLinkedinIn, FaTwitter, FaDribbble, FaGithub } from 'react-icons/fa'; // Import icons

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-simple">
      <div className="footer-container">
        {/* Logo and Tagline (Left/Top Section) */}
        <div className="footer-brand">
          <div className="footer-logo">
            Donor<span className="logo-highlight">Sync</span>
          </div>
          <p className="footer-tagline">
            A coordinated network of donors, hospitals, and blood banks.
          </p>
          
        </div>

        {/* Navigation Links (Center Section) */}
        <div className="footer-links">
          <div>
            <h4>Platform</h4>
            <ul>
              <li><a href="/#home">Home</a></li>
              <li><a href="/donate">Donate</a></li>
              <li><a href="/receive">Receive</a></li>
              <li><a href="/about">Why trust us</a></li>
            </ul>
          </div>
          <div>
            <h4>Support</h4>
            <ul>
              <li><a href="/about">About Us</a></li>
              <li><a href="/contact">Contact Desk</a></li>

            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom-bar">
        {/* <div className="footer-pills">
          <span className="footer-pill">24/7 Dispatch</span>
          <span className="footer-pill pill-verified">Verified Donors</span>
        </div> */}
        <p className="footer-center-text">
          © {currentYear} DonorSync. Built for emergencies.
        </p>
      </div>
    </footer>
  );
};

export default Footer;