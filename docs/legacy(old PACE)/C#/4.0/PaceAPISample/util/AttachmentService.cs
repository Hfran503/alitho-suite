using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;
using System.IO;

namespace Pace_Web_Service_SDK.util
{
    class AttachmentService
    {
        private String m_objectName;
        private String m_primaryKey;
        private String m_attribute;
        private Attachment m_attachment;
        public AttachmentService(String objectName, String primaryKey, String attachmentAttributeName, Attachment attachment)
        {
            m_objectName = objectName;
            m_primaryKey = primaryKey;
            m_attribute = attachmentAttributeName;
            m_attachment = attachment;
        }

        public static void Main()
        {
            Console.WriteLine("Enter the mime type");
            String mimeType = Console.ReadLine();

            // Read the attachment
            Console.WriteLine("Enter the file name to attach");
            String attachmentFileName = Console.ReadLine();
            if (!File.Exists(attachmentFileName))
            {
                Console.WriteLine("{0} does not exist!", attachmentFileName);
                return;
            }

            byte[] content = readFile(attachmentFileName);
            String[] fileNameParts = attachmentFileName.Split('.').ToArray();

            String fileName = fileNameParts[0];
            String extension = (fileNameParts.Length > 1) ? fileNameParts[1] : "";

            Attachment attachment = new Attachment();
            attachment.content = Convert.ToBase64String(content);
            attachment.fileExtension = extension;
            attachment.mimeType = mimeType;
            attachment.name = fileName;

            Console.WriteLine("Trying to create a Job");
            Job job = CreateJob.Run();

            Console.WriteLine("Job created");

            Attachment attachmentFromService = AttachmentService.Run("Job", "attachment", job.job, attachment);

            ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();

            Job retrievedJob = readObjectHttpBinding.readJob(job);
            Console.WriteLine("Job " + retrievedJob.job + " has attachment " + retrievedJob.attachment);

            UpdateObjectHttpBinding updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            retrievedJob.attachment = null;
            updateObjectHttpBinding.updateJob(retrievedJob);

            Job reretrievedJob = readObjectHttpBinding.readJob(job);
            Console.WriteLine("Job " + reretrievedJob.job + " has attachment " + reretrievedJob.attachment);
        }


        public static Attachment Run(String objectName, String attribute, String primaryKey, Attachment attachment)
        {
            AttachmentServiceHttpBinding attachmentServiceHttpBinding = PaceClient.getAttachmentServiceHttpBinding();

            // trying to set attachment
            Console.WriteLine("Trying to set attachment on object=" + objectName + "." + attribute + ", key=" + primaryKey + ", attachment=" + attachment);

            String newKey = attachmentServiceHttpBinding.setAttachment(objectName, primaryKey, attribute, attachment);

            Console.WriteLine("Saved attachment. The new attachment key = " + newKey);

            // retrieve this attachment back
            Attachment attachmentFromService = attachmentServiceHttpBinding.getAttachmentFromKey(newKey);
            Console.WriteLine("Retrieved the attachment back using key " + newKey);
            Console.WriteLine("Trying to retrieve attachment using the getAttachment method");
            Attachment attachmentFromService2 = attachmentServiceHttpBinding.getAttachment(objectName, primaryKey, attribute);
            Console.WriteLine("Retrieved attachment " + attachmentFromService2);

            return attachmentFromService;
        }

        private static byte[] readFile(String attachmentFileName)
        {
            byte[] bytes = new byte[0];
            using (FileStream fileStream = new FileStream(attachmentFileName, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                bytes = new byte[fileStream.Length];
                int numBytesToRead = (int)fileStream.Length;
                int numBytesRead = 0;
                while (numBytesToRead > 0)
                {
                    int n = fileStream.Read(bytes, numBytesRead, numBytesToRead);

                    if (n == 0)
                        break;

                    numBytesRead += n;
                    numBytesToRead -= n;
                }
            }
            return bytes;
        }
    }
}
