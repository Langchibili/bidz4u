//Okrarides\backend\src\services\messages.ts
import axios from 'axios'
import nodemailer from 'nodemailer'

interface Country {
  phoneCode: string
  phoneNumberDigitLength: number
}

interface User {
  username: string
  phoneNumber: string
  country?: Country
}

interface SmsGatewayPayload {
  apiKey: string
  username: string
  recipients: string[]
  message: string
  from: string
}

interface EmailConfig {
  config?: {
    EMAILSERVICEHOST: string
    EMAILSERVICEUSERNAME: string
    EMAILSERVICEPASSWORD: string
    EMAILSERVICEFROMEMAIL: string
  }
}

const returnNineDigitNumber = (phoneNumber: string): string => {
  return phoneNumber.replace(/\D/g, '').slice(-9)
}

export const getPhoneDigits = (phoneNumber: string | number, phoneNumberDigitLength: number = 9): string => {
  if (!phoneNumber) return '';
  let numberLength = phoneNumberDigitLength ? phoneNumberDigitLength : 9
  const digits = String(phoneNumber).replace(/\D/g, '');
  return digits.slice(-numberLength)
}

export const SendSmsNotification = async (phoneNumber: string, notificationBody: string): Promise<void> => {
  try {
    let user: any = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { username: String(phoneNumber).replace(/\D/g, '') },
      populate: {
        country: true
      }
    })
    if (!user) { // if not found, try using the number to check the account phoneNumber
      user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { phoneNumber: String(phoneNumber).replace(/\D/g, '') },
        populate: {
          country: true
        }
      })
    }
    const phoneCode = (user?.country?.phoneCode || "+260")
    const validPhoneNumber = phoneCode + getPhoneDigits(phoneNumber, user?.country?.phoneNumberDigitLength)
    axios.post(process.env.SMSGATEWAYURL + "/send-sms", {
      apiKey: process.env.SMSGATEWAYAPIKEY,
      username: process.env.SMSGATEWAYAPIUSERNAME,
      recipients: [validPhoneNumber],
      message: notificationBody,
      from: process.env.SMSGATEWAYAPICALLERID
    }, {
      headers: { 'Content-Type': 'application/json' }
    })
      .then(response => console.log('SMS sent:', response.data))
      .catch(error => console.error('Error sending SMS:', error))

    console.log('sending sms notification', validPhoneNumber, notificationBody)

  }
  catch (e) {
    console.log(e)
  }
}

export const SendEmailNotification = async (email: string, notificationBody: string): Promise<void> => {
  const emailConfig = await strapi.db.query('api::email-configuration.email-configuration').findOne()
  const EMAILSERVICEHOST = emailConfig?.config?.EMAILSERVICEHOST
  const EMAILSERVICEUSERNAME = emailConfig?.config?.EMAILSERVICEUSERNAME
  const EMAILSERVICEPASSWORD = emailConfig?.config?.EMAILSERVICEPASSWORD
  const EMAILSERVICEFROMEMAIL = emailConfig?.config?.EMAILSERVICEFROMEMAIL

  const transporter = nodemailer.createTransport({
    host: EMAILSERVICEHOST || process.env.EMAILSERVICEHOST,
    port: 465,
    secure: true, // true for 465, false for 587 (STARTTLS)
    auth: {
      user: EMAILSERVICEUSERNAME || process.env.EMAILSERVICEUSERNAME,
      pass: EMAILSERVICEPASSWORD || process.env.EMAILSERVICEPASSWORD
    }
  })

  transporter.sendMail({
    from: EMAILSERVICEFROMEMAIL || process.env.EMAILSERVICEFROMEMAIL,
    to: email,
    subject: 'Message from Okra Technologies',
    text: notificationBody
  }, (error, info) => {
    if (error) console.log('Error sending email:', error)
    else console.log('Email sent:', info.response)
  })

  console.log('sending email notification', email, notificationBody)
}
