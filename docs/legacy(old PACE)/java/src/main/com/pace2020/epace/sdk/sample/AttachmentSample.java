package com.pace2020.epace.sdk.sample;

import java.io.IOException;

import com.pace2020.epace.sdk.util.AttachmentService;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class AttachmentSample extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        AttachmentSample attachmentSample = new AttachmentSample();
        attachmentSample.addAttachment();
    }

    public void addAttachment() throws IOException
    {
        final String newKey =
            AttachmentService.addAttachment( "fileName", "application/pdf", "objectType", "objectKey", "attachment" );
        System.out.println( " Attachment created - " + newKey );

    }
}
