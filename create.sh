#!/bin/bash -e

echo "$(date): Starting"'!'

# cd into directory containing script...
cd "$(dirname "${0}")"

# generate a random slugid for aws client token...
go get github.com/taskcluster/slugid-go/slug
SLUGID=$("${GOPATH}/bin/slug")

# aws cli docs lie, they say userdata must be base64 encoded, but cli encodes for you, so just cat it...
USER_DATA="$(cat firefox.userdata)"

# find out latest windows 2012 r2 ami to use...
AMI="$(aws ec2 describe-images --owners self amazon --filters "Name=platform,Values=windows" "Name=name,Values=Windows_Server-2012-R2_RTM-English-64Bit-Base*" --query 'Images[*].{A:CreationDate,B:ImageId}' --output text | sort -u | tail -1 | cut -f2)"
echo "$(date): Latest Windows 2012 R2 AMI in Oregon is: ${AMI}"

# create base ami, and apply user-data
# filter output, to get INSTANCE_ID
INSTANCE_ID="$(aws --region us-west-2 ec2 run-instances --image-id "${AMI}" --key-name pmoore-oregan-us-west-2 --security-groups "RDP only" --user-data "$(cat firefox.userdata)" --instance-type c4.2xlarge --block-device-mappings DeviceName=/dev/sda1,Ebs='{VolumeSize=75,DeleteOnTermination=true,VolumeType=gp2}' --instance-initiated-shutdown-behavior terminate --client-token "${SLUGID}" | sed -n 's/^ *"InstanceId": "\(.*\)", */\1/p')"

echo "$(date): I've triggered the creation of instance ${INSTANCE_ID} - but now we will need to wait an hour("'!'") for it to be created and bootstrapped..."

# sleep an hour, the installs take forever...
sleep 3600

echo "$(date): Now snapshotting the instance to create an AMI..."
# now capture the AMI
IMAGE_ID="$(aws --region us-west-2 ec2 create-image --instance-id "${INSTANCE_ID}" --name "win2012r2 mozillabuild pmoore version ${SLUGID}" --description "firefox desktop builds on windows - taskcluster worker - version ${SLUGID}" | sed -n 's/^ *"ImageId": *"\(.*\)" *$/\1/p')"

echo "$(date): The AMI is currently being created: ${IMAGE_ID}"

PASSWORD="$(aws ec2 get-password-data --instance-id "${INSTANCE_ID}" --priv-launch-key ~/.ssh/pmoore-oregan-us-west-2.pem --output text --query PasswordData)"
PUBLIC_IP="$(aws ec2 describe-instances --instance-id "${INSTANCE_ID}" --query 'Reservations[*].Instances[*].NetworkInterfaces[*].Association.PublicIp' --output text)"

echo "$(date): To connect to the template instance (please don't do so until AMI creation process is completed"'!'"):"
echo
echo "             Public IP: ${PUBLIC_IP}"
echo "             Username:  Administrator"
echo "             Password:  ${PASSWORD}"
echo
echo "$(date): To monitor the AMI creation process, see:"
echo
echo "             https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2#Images:visibility=owned-by-me;search=${IMAGE_ID};sort=desc:platform"
echo
echo "$(date): Don't forget to update the worker type:"
echo
echo "             https://tools.taskcluster.net/aws-provisioner/#win2012r2/edit"

# TODO: update worker type automatically...
