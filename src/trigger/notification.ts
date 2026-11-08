import { logger, schemaTask } from "@trigger.dev/sdk"
import { SendMailClient } from "zeptomail"
import { z } from "zod"

///////////////////////////////////////////apply job and send mail///////////////////////////////////////////////////////////////
export const applyJobAndSendEmail = schemaTask({
  id: "apply-job-and-send-email",
  retry: {
    maxAttempts: 2,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    user_email: z.string(),
    user_name: z.string(),
    job_title: z.string(),
    company_name: z.string(),
    phone_number: z.string(),
    send_whatsapp: z.boolean().default(false),
    send_email: z.boolean().default(false),
  }),

  run: async (payload) => {
    logger.info("Starting applyJobAndSendEmail task", { payload })
    const { user_email, user_name, job_title, company_name, phone_number, send_whatsapp, send_email } =
      payload

    if (send_email) {
      logger.info("Initiating email sending process", { user_email, job_title })
      try {
        const sendMailClient = new SendMailClient({
          token: process.env.ZEPTOMAIL_API_KEY,
          url: process.env.ZEPTOMAIL_URL,
        })

        logger.debug("Email template parameters", { 
          company_name, 
          user_name, 
          job_title 
        })
        await sendMailClient.sendMailWithTemplate({
          template_key:
            "2518b.1f3f9645fe91eda6.k1.338f67b0-bb87-11ef-aefe-52540038fbba.193ce91d1ab",
          template_alias: "jobapplication",
          from: {
            address: "no-reply@xcelerator.co.in",
            name: "Xcelerator",
          },
          to: [
            {
              email_address: {
                address: user_email,
                name: user_name,
              },
            },
          ],
          merge_info: {
            COMPANY: company_name,
            name: user_name,
            job_title: job_title,
          },
          reply_to: [
            {
              address: "support@xcelerator.co.in",
              name: "Support Team",
            },
          ],
        })
        logger.info("Email sent successfully", { user_email })
      } catch (error) {
        logger.error("Email sending failed", { error, user_email })
        throw error
      }
    } else {
      logger.info("Email sending skipped", { send_email })
    }

    if (send_whatsapp) {
      logger.info("Initiating WhatsApp message sending", { phone_number })
      try {
        const watiBaseUrl = process.env.WATI_API_URL
        const watiUrl = `${watiBaseUrl}/sendTemplateMessage`
        const watiToken = process.env.WATI_API_KEY
        const queryParams = new URLSearchParams({
          whatsappNumber: phone_number,
        })
        const watiPayload = {
          template_name: "job_application_notification",
          broadcast_name: "job_application_notification_171220241949",
          parameters: [
            { name: "name", value: user_name },
            { name: "job_title", value: job_title },
            { name: "company", value: company_name },
            { name: "navigate", value: "listing" },
          ],
        }

        logger.debug("WhatsApp payload", { watiPayload })

        const watiResponse = await fetch(`${watiUrl}?${queryParams.toString()}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${watiToken}`,
          },
          body: JSON.stringify(watiPayload),
        })

        if (!watiResponse.ok) {
          const responseText = await watiResponse.text();
          logger.error("WhatsApp API error", { 
            status: watiResponse.status,
            statusText: watiResponse.statusText,
            responseText,
            phone_number 
          });
          throw new Error(`WATI API Error: ${watiResponse.status} - ${responseText}`);
        }
        logger.info("WhatsApp message sent successfully", { phone_number })
      } catch (error) {
        logger.error("WhatsApp sending failed", { error, phone_number })
        throw error
      }
    } else {
      logger.info("WhatsApp sending skipped", { send_whatsapp })
    }

    return { message: "Notifications sent successfully" }
  },
})

//////////////////////////////////////////////////Sending Decision notification/////////////////////////////////////////////////////////////////

export const sendDecisionMail = schemaTask({
  id: "send-decision-mail",
  retry: {
    maxAttempts: 3,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    user_email: z.string(),
    user_name: z.string(),
    job_title: z.string(),
    company_name: z.string(),
    decision: z.string(),
    stage_title: z.string().optional(),
    feedback: z.string().optional(),
    phone_number: z.string(),
    send_whatsapp: z.boolean().default(false),
    send_email: z.boolean().default(false),
  }),

  run: async (payload) => {
    logger.info("Starting sendDecisionMail task", { payload })
    const {
      user_email,
      user_name,
      job_title,
      company_name,
      decision,
      stage_title,
      feedback,
      phone_number,
      send_whatsapp,
      send_email,
    } = payload

    if (send_email) {
      logger.info("Initiating decision email process", { 
        user_email, 
        decision 
      })
      try {
        const sendMailClient = new SendMailClient({
          token: process.env.ZEPTOMAIL_API_KEY,
          url: process.env.ZEPTOMAIL_URL,
        })

        const templateKey =
          decision === "accepted"
            ? "2518b.1f3f9645fe91eda6.k1.15977ad0-bb88-11ef-aefe-52540038fbba.193ce979afd"
            : "2518b.1f3f9645fe91eda6.k1.b05ad071-bb89-11ef-aefe-52540038fbba.193cea21ef4"

        const templateAlias =
          decision === "accepted" ? "applicationaccepted" : "applicationrejected"

        const mergeInfo =
          decision === "accepted"
            ? {
                feedback: feedback || "All the best!",
                student_name: user_name || "Candidate",
                stage: stage_title || "Next round",
                company_name: company_name,
                job_title: job_title,
              }
            : {
                feedback: feedback || "All the best for future!",
                student_name: user_name || "Candidate",
                company_name: company_name,
                job_title: job_title,
              }

        logger.debug("Email template selected", { 
          templateKey, 
          templateAlias,
          mergeInfo 
        })
        await sendMailClient.sendMailWithTemplate({
          template_key: templateKey,
          template_alias: templateAlias,
          from: {
            address: "no-reply@xcelerator.co.in",
            name: "Xcelerator",
          },
          to: [
            {
              email_address: {
                address: user_email,
                name: user_name,
              },
            },
          ],
          merge_info: mergeInfo,
          reply_to: [
            {
              address: "support@xcelerator.co.in",
              name: "Support Team",
            },
          ],
        })
        logger.info("Decision email sent successfully", { 
          user_email, 
          decision 
        })
      } catch (error) {
        logger.error("Decision email failed", { error, user_email })
        throw error
      }
    }

    if (send_whatsapp) {
      logger.info("Initiating decision WhatsApp message", { 
        phone_number,
        decision 
      })
      try {
        const watiUrl = process.env.WATI_API_URL
        const watiTemplateName =
          decision === "accepted" ? "application_accepted" : "application_rejected"

        const watiPayload =
          decision === "accepted"
            ? {
                template_name: watiTemplateName,
                broadcast_name: watiTemplateName,
                parameters: [
                  { name: "student_name", value: user_name },
                  { name: "company_name", value: company_name },
                  { name: "job_title", value: job_title },
                  { name: "stage", value: stage_title || "Next round" },
                  { name: "navigate", value: "listing" },
                ],
              }
            : {
                template_name: watiTemplateName,
                broadcast_name: watiTemplateName,
                parameters: [
                  { name: "student_name", value: user_name },
                  { name: "company_name", value: company_name },
                  { name: "job_title", value: job_title },
                  { name: "navigate", value: "jobs" },
                ],
              }

        logger.debug("WhatsApp payload for decision", { watiPayload })

        const queryParams = new URLSearchParams({
          whatsappNumber: phone_number,
        })

        const watiResponse = await fetch(
          `${watiUrl}/sendTemplateMessage?${queryParams.toString()}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json-patch+json",
              Authorization: `Bearer ${process.env.WATI_API_KEY}`,
            },
            body: JSON.stringify(watiPayload),
          }
        )

        if (!watiResponse.ok) {
          const responseText = await watiResponse.text();
          logger.error("WATI API Error", {
            status: watiResponse.status,
            statusText: watiResponse.statusText,
            responseText
          });
          throw new Error(`WATI API Error: ${watiResponse.status} - ${responseText}`);
        }

        logger.info("Decision WhatsApp sent successfully", { 
          phone_number,
          decision 
        })
      } catch (error) {
        logger.error("Decision WhatsApp failed", { error, phone_number })
        throw error
      }
    }

    return { message: "Decision notifications sent successfully" }
  },
})

/////////////////////////////////////////////////////////send job notification////////////////////////////////////////////////////////

export const sendJobEmail = schemaTask({
  id: "send-job-email-facilitator",
  retry: {
    maxAttempts: 3,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    job_type: z.string(),
    website: z.string().url(),
    company_name: z.string(),
    application_deadline: z.string(),
    salary: z.string(),
    institute_name: z.string(),
    job_title: z.string(),
    job_location: z.string(),
    institute_email: z.string().email(),
    send_whatsapp: z.boolean().default(false),
    send_email: z.boolean().default(false),
    phone_number: z.string(),
  }),

  run: async (payload) => {
    logger.info("Starting sendJobEmail task", { payload })
    const {
      job_type,
      website,
      company_name,
      application_deadline,
      salary,
      institute_name,
      job_title,
      job_location,
      institute_email,
      send_email,
      send_whatsapp,
      phone_number,
    } = payload

    // Initialize ZeptoMail client
    const sendMailClient = new SendMailClient({
      token: process.env.ZEPTOMAIL_API_KEY,
      url: process.env.ZEPTOMAIL_URL,
    })

    // Send email only if send_email is true
    if (send_email) {
      logger.info("Initiating job notification email", { 
        institute_email,
        job_title 
      })
      try {
        logger.debug("Job notification email parameters", {
          job_type,
          company_name,
          job_title,
          job_location
        })
        await sendMailClient.sendMailWithTemplate({
          template_key:
            "2518b.1f3f9645fe91eda6.k1.ef858281-bb8a-11ef-aefe-52540038fbba.193ceaa4a9f", // Replace with your template key
          template_alias: "jobposting", // Replace with your template alias
          from: {
            address: "no-reply@xcelerator.co.in",
            name: "Xcelerator",
          },
          to: [
            {
              email_address: {
                address: institute_email,
                name: institute_name,
              },
            },
          ],
          merge_info: {
            job_type,
            website,
            company_name,
            application_deadline,
            salary,
            institute_name,
            job_title,
            job_location,
          },
          reply_to: [
            {
              address: "support@xcelerator.co.in", // Support email
              name: "Support Team",
            },
          ],
        })
        logger.info("Job notification email sent", { institute_email })
      } catch (error) {
        logger.error("Job notification email failed", { 
          error, 
          institute_email 
        })
        throw error
      }
    }

    if (send_whatsapp) {
      logger.info("Initiating job notification WhatsApp", { phone_number })
      try {
        const watiBaseUrl = process.env.WATI_API_URL
        const watiUrl = `${watiBaseUrl}/sendTemplateMessage`
        const watiToken = process.env.WATI_API_KEY
        const queryParams = new URLSearchParams({
          whatsappNumber: phone_number,
        })
        const watiPayload = {
          template_name: "job_updates",
          broadcast_name: "job_updates",
          parameters: [
            { name: "job_type", value: job_type },
            { name: "website", value: website },
            { name: "company_name", value: company_name },
            { name: "application_deadline", value: application_deadline },
            { name: "salary", value: salary },
            { name: "institute_name", value: institute_name },
            { name: "job_title", value: job_title },
            { name: "job_location", value: job_location },
            { name: "navigate", value: "listing" },
          ],
        }

        logger.debug("Job notification WhatsApp payload", { watiPayload })

        const watiResponse = await fetch(`${watiUrl}?${queryParams.toString()}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${watiToken}`,
          },
          body: JSON.stringify(watiPayload),
        })

        if (!watiResponse.ok) {
          const responseText = await watiResponse.text();
          logger.error("Job notification WhatsApp failed", { 
            status: watiResponse.status,
            statusText: watiResponse.statusText,
            responseText,
            phone_number 
          });
          throw new Error(`WATI API Error: ${watiResponse.status} - ${responseText}`);
        }
        logger.info("Job notification WhatsApp sent", { phone_number })
      } catch (error) {
        logger.error("Job notification WhatsApp failed", { 
          error,
          phone_number 
        })
        throw error
      }
    }

    return { message: "Job notifications sent successfully" }
  },
})
