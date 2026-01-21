'use client'

import { useEffect, useState } from 'react'
import styles from './holiday-gift.module.css'

function useGlobalStyles() {
  useEffect(() => {
    // Hide scrollbar visually while still allowing scroll
    const style = document.createElement('style')
    style.id = 'hide-scrollbar'
    style.textContent = `
      html, body {
        margin: 0;
        padding: 0;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      html::-webkit-scrollbar, body::-webkit-scrollbar {
        display: none;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.getElementById('hide-scrollbar')?.remove()
    }
  }, [])
}

const gifts = [
  
  {
    id: 'game-night',
    name: 'The Game Night Gift Box',
    description: 'Let the games and the memories begin!',
    url: 'https://calithogift.myprintdesk.net/DSF/StoreFront.web/product.aspx?productid=86',
    image: '/images/110710_Calitho_Get Movin_Influencer Kit_Face-Red.jpg'
  },
  {
    id: 'get-moving',
    name: 'The Get Moving Gift Box',
    description: 'Let\'s get moving, motivation included.',
    url: 'https://calithogift.myprintdesk.net/DSF/StoreFront.web/product.aspx?productid=87',
    image: '/images/110710_Calitho_Get Movin_Influencer Kit_Face-Blue.jpg'
  },
  {
    id: 'chill-out',
    name: 'The Chill Out Gift Box',
    description: 'Your moment of calm starts here..',
    url: 'https://calithogift.myprintdesk.net/DSF/StoreFront.web/product.aspx?productid=85',
    image: '/images/110710_Calitho_Get Movin_Influencer Kit_Face-Green.jpg'
  },
  {
    id: 'mystery',
    name: 'The “Surprise Me” Gift Box',
    description: 'I can’t decide, surprise me!',
    url: 'https://calithogift.myprintdesk.net/DSF/StoreFront.web/product.aspx?productid=88',
    image: '/images/110710_Calitho_Get Movin_Influencer Kit_Face-Silver.jpg'
  }
]

export default function HolidayGiftPage() {
  useGlobalStyles()
  const [step, setStep] = useState(1)
  const [selectedGift, setSelectedGift] = useState<typeof gifts[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'USA'
  })

  const handleGiftSelect = (gift: typeof gifts[0]) => {
    setSelectedGift(gift)
    setStep(3)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedGift) return

    setIsSubmitting(true)

    try {
      // Save the order to the database
      const response = await fetch('/api/holiday-gifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          giftId: selectedGift.id,
          giftName: selectedGift.name,
          ...formData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit order')
      }

      // Move to confirmation step after successful save
      setStep(4)
    } catch (error) {
      console.error('Error submitting order:', error)
      alert('Failed to submit order. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroContent}>
        <div className={styles.logoSection}>
          <img
            src="/images/calitho-logo-white.png"
            alt="Calitho"
            className={styles.companyLogo}
          />
          <p className={styles.tagline}>Your Print and Packaging Partners</p>
        </div>

        {step === 1 ? (
          <div className={styles.giftMessage}>
            <p className={styles.seasonGreeting}>Happy New Year! 🎉</p>

            <div className={styles.giftBox}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="35" width="60" height="50" fill="#4ecdc4" stroke="#1a9b8e" strokeWidth="2"/>
                <rect x="20" y="25" width="60" height="10" fill="#ffd700" stroke="#daa520" strokeWidth="2"/>
                <rect x="47" y="25" width="6" height="60" fill="#ffd700"/>
                <rect x="20" y="47" width="60" height="6" fill="#ffd700"/>
                <circle cx="35" cy="22" r="8" fill="#ffd700"/>
                <circle cx="50" cy="22" r="8" fill="#ffd700"/>
                <circle cx="65" cy="22" r="8" fill="#ffd700"/>
                <circle cx="50" cy="15" r="5" fill="#ffed4e"/>
              </svg>
            </div>

            <h2 className={styles.giftTitle}>Our Gift to You This Season</h2>

            <p className={styles.giftDescription}>
              Thank you for being an important part of our year. In appreciation, we’ve custom-made gift boxes inspired by the different ways to welcome 2026. 
              Choose the one that feels right for you!
            </p>

            <button onClick={() => setStep(2)} className={styles.ctaButton}>
              Choose Your Gift
            </button>
          </div>
        ) : step === 2 ? (
          <div className={styles.giftMessage}>
            <p className={styles.seasonGreeting}>Happy New Year! 🎁</p>

            <h2 className={styles.giftTitle}>Choose Your Perfect Gift</h2>

            <p className={styles.giftDescription}>
             We hope this gift brings a little joy and helps you step into 2026 feeling playful, energized or blissfully calm.
            </p>

            <div className={styles.giftGrid}>
              {gifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => handleGiftSelect(gift)}
                  className={styles.giftCard}
                >
                  <img
                    src={gift.image}
                    alt={gift.name}
                    className={styles.giftCardIconImage}
                  />
                  <h3 className={styles.giftCardTitle}>{gift.name}</h3>
                  <p className={styles.giftCardDescription}>{gift.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : step === 3 ? (
          <div className={styles.giftMessage}>
            <p className={styles.seasonGreeting}>🎁 Shipping Information</p>

            <h2 className={styles.giftTitle}>Almost There!</h2>

            <p className={styles.giftDescription}>
              Please provide your shipping information so we can send your {selectedGift?.id === 'mystery' ? 'surprise gift' : selectedGift?.name} to you.
            </p>

            <form onSubmit={handleSubmit} className={styles.shippingForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="firstName" className={styles.formLabel}>First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="lastName" className={styles.formLabel}>Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.formLabel}>Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="phone" className={styles.formLabel}>Phone Number *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="address" className={styles.formLabel}>Street Address *</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  required
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="city" className={styles.formLabel}>City *</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="state" className={styles.formLabel}>State/Province *</label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="zipCode" className={styles.formLabel}>ZIP/Postal Code *</label>
                  <input
                    type="text"
                    id="zipCode"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleInputChange}
                    required
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="country" className={styles.formLabel}>Country</label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  value="USA"
                  readOnly
                  className={styles.formInput}
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={styles.backButton}
                  disabled={isSubmitting}
                >
                  Back to Gifts
                </button>
                <button type="submit" className={styles.ctaButton} disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Complete Order'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className={styles.giftMessage}>
            <p className={styles.seasonGreeting} style={{ fontSize: '2.5rem' }}>Order Confirmed!</p>

            <div className={styles.giftBox}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="40" fill="#4ecdc4" stroke="#1a9b8e" strokeWidth="3"/>
                <path d="M30 50 L45 65 L70 35" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>

            <h2 className={styles.giftTitle}>Thank You!</h2>

            <p className={styles.giftDescription}>
              Your order for <strong>{selectedGift?.id === 'mystery' ? 'a surprise gift' : selectedGift?.name}</strong> has been received!
              <br /><br />
              We&apos;ll be processing your gift and shipping it to:
              <br />
              <strong>{formData.firstName} {formData.lastName}</strong>
              <br />
              {formData.address}
              <br />
              {formData.city}, {formData.state} {formData.zipCode}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
